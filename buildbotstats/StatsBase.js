define(["dojo/_base/declare", "dijit/_Widget", "dijit/_Templated",
	"dojo/store/Memory", "dojo/store/Observable",
	"dijit/ProgressBar","dijit/Dialog",
	"dojox/charting/Theme", "dojox/charting/action2d/PlotAction"
       ],
       function(declare, _Widget, _Templated, Memory, Observable, ProgressBar, Dialog, Theme, PlotAction) {
    "use strict";
    return declare("buildbotstats.StatsBase", [_Widget, _Templated], {
	//	some properties
	baseClass: "BuildbotStats",
	title: "",	//	we'll set this from the widget defe
	history: 100,
	widgetsInTemplate: true,
	min_build_time: 3/60.0, /* 3min */
	store: new Observable(new Memory({ data: [] })),

	constructor: function(args){
            declare.safeMixin(this,args);
	    /* allow chrome to display correctly generic errbacks from dojo */
	    console.error = function(err) {
		console.log(err);
		console.log(err.message);
		console.log(err.stack);
	    };
	    /* add fonctionnalities to Array (min/max/avg)*/
	    Array.prototype.max = function(){
		return Math.max.apply( {}, this );
	    };
	    Array.prototype.min = function(){
		return Math.min.apply( {}, this );
	    };
	    Array.prototype.avg = function(){
		var i,sum=0;
		if (this.length === 0) {
		    return 0;
		}
		for(i=0;i<this.length;i+=1){
		    sum+=this[i];
		}
		return sum/this.length;
	    };
	    Array.prototype.sort_by_attrib =
		function (attrib) {
		    return this.sort(function(a,b) {
			if(a[attrib] > b[attrib]){ return 1; }
			if(a[attrib] < b[attrib]){ return -1; }
			return 0;
		    });
		};
	},
	maybe_init: function(d, val, init) {
	       if (!d.hasOwnProperty(val)) {
		   d[val] = init;
	       }
	},
	increment_stat: function(d, val) {
	    this.maybe_init(d, val, 0);
	    d[val] +=1;
	},
	increment_stat_with_meta:function (d, val, meta) {
	    this.maybe_init(d, val, []);
	    d[val].push(meta);
	},
	_int:function(x) {
	    return parseInt(x,10);
	},
	show_progress:function() {
	    this.progress_dialog = new Dialog({
		title: "Getting data from server...",
		content: new ProgressBar({indeterminate:true}),
		style: "width: 300px"
	    });
	    this.progress_dialog.show();
	},
	hide_progress:function() {
	    this.progress_dialog.destroy();
	},
	get_stats:function(branchname, buildername, props, limit, cb) {
	    this.show_progress();
	    var _buildername = branchname+"-";
	    _buildername += buildername.join(","+_buildername);
	    var _props = props.join(",");
	    var def =  dojo.xhrGet({
		url: "/absp-test/json/buildrequests?props="+_props+"&buildername="+buildername+"&limit="+limit,
		handleAs:"json"
	    });
	    def.then(dojo.hitch(this,function(res) { this.hide_progress();return res;}));
	    return def;
	},
	PieAction:declare(PlotAction, {
		       constructor: function(chart, plot, callback){
			   this.callback = callback;
			   this.connect();
		       },
		       process: function(o){
			   if(o.shape && o.type === "onclick" || o.type === "onmouseover"){
			       this.callback(o.index, o.type === "onclick");
			   }
		       }
	}),
	theme1:new Theme({
	    chart: {
		fill: { type: "linear", x1: 0, y1: 0, x2: 0, y2: 240, colors: [
		    { offset: 0, color: "#ececec" },
		    { offset: 0.5, color: "#cecece" },
		    { offset: 1, color: "#ececec" }
		]
		      }
	    },
	    plotarea: {
		fill: { type: "linear", x1: 0, y1: 0, x2: 0, y2: 240, colors: [
		    { offset: 0, color: "#ececec" },
		    { offset: 0.5, color: "#cecece" },
		    { offset: 1, color: "#ececec" }
		]
		      }
	    },
	    marker: {
		symbol: Theme.defaultMarkers.CIRCLE
	    }
	}),
	theme2:new Theme({
	    plotarea: {
		fill: null
	    },
	    colors: [
		"#57808f",
		"#506885",
		"#4f7878",
		"#558f7f",
		"#508567"
	    ]
	}),
	ts2date:function(ts) {
	    var d = new Date();
	    d.setTime(ts*1000);
	    return d;
	},
	ts2hour:function(ts) {
	    return ts/3600.0;
	},
	hour2min:function(h) {
	    return h*60;
	},
	formatNumber:function(n) {
	    if (n <10) { return "0"+n;}
	    return n;
	},
	formatDate:function(d) {
	    return (this.formatNumber(d.getMonth()+1))+"/"+this.formatNumber(d.getDate());
	},
	formatTime:function(t) {
	    var ret = "";
	    if (t>1) {
		ret += this._int(t)+"h";
		t-= this._int(t);
	    }
	    t *= 60;
	    return ret + this._int(t)+"mn";
	},
	genCandle: function (list, label, long_builds) {
	    var m = list.min();
	    var M = list.max();
	    var a = list.avg();
	    var ret =  {low:m,
			high:M,
			open:a-0.1,
			close:a+0.1,
			tooltip:label+
			"<br>Min:"+this.formatTime(m)+
			"<br/>Max:"+this.formatTime(M)+
			"<br/>Avg:"+this.formatTime(a)+
			"<br/>"+long_builds.join("<br/>")
		       };
	    return ret;
	}
    });
});
