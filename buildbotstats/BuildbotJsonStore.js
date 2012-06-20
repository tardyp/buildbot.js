define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/store/JsonRest",
    "dojo/store/util/QueryResults",
    "dojo/_base/Deferred",
    "dojo/store/Observable", "dojo/store/Cache", "dojo/store/Memory"
],function(declare, lang, JsonRest,queryResults, Deferred, Observable, Cache, Memory) {
    "use strict";
    // A BuildbotJsonStore is an extension of JsonRestStore to handle buildbot's idiosyncrasies, special features,
    // and deviations from standard HTTP Rest.
    return function(args) {
	var LocalStoreBackedMemory = Memory; /* if browser does not support, we use Memory*/

	if (typeof(localStorage) !== 'undefined' ) {
		LocalStoreBackedMemory = declare([Memory], {
		    doSaveData:0,
		    constructor: function(options){
			var data = dojo.fromJson(localStorage.getItem(options.key));
			if (data !== null) {
			    Memory.prototype.setData.call(this,data);
			}
			this.doSaveData = 1;
		    },
		    put: function(object, options){
			var result = Memory.prototype.put.call(this, object, options);
			this.saveData();
			return result;
		    },
		    setData: function(data){
			var result = Memory.prototype.setData.call(this, data);
			this.saveData();
			return result;
		    },
		    saveData: function(){
			if (!this.doSaveData) {
			    return;
			    }
			var value = dojo.toJson(this.data);
			try { // ua may raise an QUOTA_EXCEEDED_ERR exception
				localStorage.setItem(this.key,value);
			} catch(e) {
			    console.error(e);
			}
		    }
		});
	}
	var cache = new LocalStoreBackedMemory({key:args.target,idProperty:"Number"});
	var MyJsonStore = declare("buildbotstats.BuildbotJsonStore", [JsonRest], {
	current: [],
	get: function(id, options){
	    var ret = cache.get(this.buildnumbers[id], options);
	    return ret;
	},
	query: function(query, options){
	    var needFetchData = [];
	    var ret = []; /* we fill this table with cached data */
	    var numbers2ids = {};

	    /* buildbot json RPC cannot sort, so we use the cached data instead */
	    /* @todo should make sure all data has been fetched before... */
	    if(options && options.sort){
		return cache.query(query, options);
	    }

	    if(options.start >= 0 || options.count >= 0){
		for (var i=0; i< options.count; i+=1) {
		    var cached = cache.get(this.buildnumbers[options.start+i]);
		    if (typeof(cached) === "undefined") { /* then we need to fetch the needFetchData */
			needFetchData.push(this.buildnumbers[options.start+i]);
			numbers2ids[this.buildnumbers[options.start+i]] = options.start+i;
		    } else {
			cached.id =  options.start+i;
			ret.push(cached);
		    }

		}
	    } else {
		console.log("this query type is not supported!",arguments);
	    }
	    var results = {}; /* if not data, dojo. when will trigger immediatly with empty result
			       Everything is already from cache anyway.. */
	    if (needFetchData.length>0) {
		/* query for the data that is not cached */
		var selects = needFetchData.join("&select=");
		var _query = this.target+"?select="+selects;
		results = dojo.when(this.current, dojo.hitch(this, function() {
		    console.log(_query);
		    this.current = new dojo.xhrGet({
			url: _query,
			handleAs:"json"
		    });
		    return this.current;
		}));
	    }
	    results = dojo.when(results, function(d) {
		function formatNumber(n) {
		    if (n <10) { return "0"+n;}
		    return n;
		}
		function formatTime(t) {
		    var ret = "";
		    t /= 3600;
		    ret += formatNumber(parseInt(t,10))+"h";
		    t-= parseInt(t,10);
		    t *= 60;
		    return ret + formatNumber(parseInt(t,10))+"mn";
		}
		for (var i in d) {
		    if (d.hasOwnProperty(i)) {
			i = d[i];
			var repoTime = "n/a";
			var buildTime = "n/a";
			for (var j = 0; j < i.steps.length; j+=1) {
			    if (i.steps[j].name === "repo") {
				repoTime = i.steps[j].times[1] - i.steps[j].times[0];
			    }
			    if (i.steps[j].name === "build_all") {
				buildTime = i.steps[j].times[1] - i.steps[j].times[0];
			    }
			}
			var value = {
			    id: numbers2ids[i.number],
			    Name: i.builderName,
			    Number: i.number,
			    RepoTime: formatTime(repoTime),
			    BuildTime: formatTime(buildTime),
			    SlaveName: i.slave
			};
			ret.push(value);
			cache.put(value);
		    }
		}
		ret.sort(function(a,b) { return a.id-b.id;});
		return ret;
	    });
	    results = lang.delegate(results);
	    results.total = dojo.when(results, dojo.hitch(this,function(){
		return this.buildnumbers.length;
	    }));
	    return queryResults(results);
	}
	});
	return new Observable(new MyJsonStore(args));
    };
});
