define([
    "dgrid/List",
    "dgrid/OnDemandGrid",
    "dgrid/Selection",
    "dgrid/Keyboard",
    "dgrid/extensions/ColumnHider",
    "dojo/_base/declare",
    "dojo/_base/array",
    "dojo/store/Memory", "dojo/store/Observable"
], function(List, Grid, Selection, Keyboard, Hider, declare, arrayUtil, Memory, Observable){
    "use strict";
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
   return declare("buildstats.BuildsTable", [], {
       node:"BuildsTable",
       buildername:"build-ics",
       buildnumbers:[],
	// The constructor
	constructor: function(args){
            declare.safeMixin(this,args);
	    var data = {
		identifier: "Number",
		label: "Number",
		items: []
		};

	    this.store = new Observable(new Memory({data: data}));
	    this.grid = new (declare([Grid, Selection, Keyboard, Hider]))({
		store: this.store,
		columns: {
		    Name: "Builder Name",
		    Number: "Build Number",
		    RepoTime: "Repo Time",
		    BuildTime: "Build Time",
		    SlaveName: "Slave Name"
		}
	    }, this.node);
	    this.grid.refresh();
	    this.fetchSomeData();
	    this.grid.on(".dgrid-row:dblclick", dojo.hitch(this, this.rowDblClick));
	},
       findCellRowBuildNumber: function(node) {
	   while(typeof(node) !== "undefined") {
	       if (node.id.split("-")[1] === "row"){
		   return node.id.split("-")[2];
	       }
	       node = node.parentElement;
	   }
	   return 0;
       },
       rowDblClick : function(evt) {
	   var buildnumber = this.findCellRowBuildNumber(evt.srcElement);
	   window.open('/absp/builders/'+this.buildername+"/builds/"+buildnumber,'_newtab');
       },
       fetchSomeData : function() {
	   var data = this.buildnumbers.splice(0,10);
	   if (data.length>0) {
	       var selects = data.join("&select=");
	       dojo.xhrGet({
		   url: "/absp/json/builders/"+this.buildername+"/builds?select="+selects,
		   handleAs:"json",
		   load: dojo.hitch(this,this.gotData)
	       });
	   }
       },
       gotData: function(d) {
	   console.log(d);
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
		    this.store.add({
			Name: i.builderName,
			Number: i.number,
			RepoTime: formatTime(repoTime),
			BuildTime: formatTime(buildTime),
			SlaveName: i.slave
		    });
		}
	    }
	   this.grid.refresh();
	   this.fetchSomeData();

	},
       destroy: function() {
	   this.grid.destroy();
	   this.store.destroy();
       }
    });
});