define(["dojo/_base/declare", "dijit/_Widget", "dijit/_Templated", "dojo/dom-style", "dojo/ready", "dojox/charting/Chart",
	"dojo/store/Memory","dojo/store/Observable", "dojox/charting/StoreSeries",
	"dojox/charting/Theme", "dojox/charting/action2d/PlotAction",
	"dojox/charting/axis2d/Default", "dojox/charting/plot2d/Columns", "dojox/charting/plot2d/Lines",
	"dojox/charting/plot2d/Pie", "dojox/charting/plot2d/Grid","dojox/charting/plot2d/StackedColumns","dojox/charting/plot2d/Candlesticks",
	"dojox/charting/action2d/Tooltip", "dojox/charting/action2d/Highlight", "dojox/charting/plot2d/MarkersOnly", "dijit/form/NumberSpinner","dijit/form/Button","dijit/form/MultiSelect",
	"dojox/charting/widget/Chart2D","dijit/ProgressBar","dijit/Dialog","dijit/layout/BorderContainer","dijit/layout/ContentPane", "dijit/form/CheckBox","buildbotstats/BuildsTable",
	"dojo/text!./templates/persitestats.html"],
       function(declare,  _Widget, _Templated, domStyle, ready, Chart, Memory,Observable, StoreSeries,
		Theme, PlotAction, Default, Columns, Lines, Pie, Grid,
		StackedColumns, Candlesticks, Tooltip, Highlight, markers, NumberSpinner, Button, MultiSelect, Chart2D,
		ProgressBar, Dialog, BorderContainer, ContentPane, CheckBox, BuildsTable,
		template){
	   "use strict";
	   /* allow chrome to display correctly generic errbacks from dojo */
	   console.error = function(err) {
	       console.log(err);
	       console.log(err.message);
	       console.log(err.stack);
	   };
	   // Declare our widget
	   function maybe_init(d, val, init) {
	       if (!d.hasOwnProperty(val)) {
		   d[val] = init;
	       }
	   }
	   function increment_stat(d, val) {
	       maybe_init(d, val, 0);
	       d[val] +=1;
	   }
	   function increment_stat_with_meta(d, val, meta) {
	       maybe_init(d, val, []);
	       d[val].push(meta);
	   }
	   function ts2date(ts) {
	       var d = new Date();
	       d.setTime(ts*1000);
	       return d;
	   }
	   function formatDate(d) {
	       function formatNumber(n) {
		   if (n <10) { return "0"+n;}
		   return n;
	       }
	       return (formatNumber(d.getMonth()+1))+"/"+formatNumber(d.getDate());
	   }
	   function formatTime(t) {
	       var ret = "";
	       if (t>1) {
		   ret += _int(t)+"h";
		   t-= _int(t);
	       }
	       t *= 60;
	       return ret + _int(t)+"mn";
	   }
	   Array.prototype.sort_by_attrib =
	       function (attrib) {
		   return this.sort(function(a,b) {
		       if(a[attrib] > b[attrib]){ return 1; }
		       if(a[attrib] < b[attrib]){ return -1; }
		       return 0;
		   });
	       };
	   function _int(x) { return parseInt(x,10);}
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
	   return declare("buildbotstats.PerSiteStats", [_Widget, _Templated], {
	       //	get our template
	       templateString: template,
	       //	some properties
	       baseClass: "BuildbotStats",
	       title: "",	//	we'll set this from the widget defe
	       history: 100,
	       widgetsInTemplate: true,
	       store: new Observable(new Memory({ data: [] })),

	       //	define an onClick handler
	       generateCharts: function(){
		   document.perownerstat=this; /* for debug */
		   if (!this.numbuilds.isValid()) {
		       return;
		   }
		   if(typeof(this.buildtable)!=='undefined') {
		       this.chart1.chart.destroy();
		       this.buildtable.destroy();
		   }
		   this.progress_dialog = new Dialog({
		       title: "Getting data from server...",
		       content: new ProgressBar({indeterminate:true}),
		       style: "width: 300px"
		   });
		   this.progress_dialog.show();
		   dojo.xhrGet({
		       url: "/absp-test/json/buildrequests?props=preferred_site,slavename,force_build_clean,variant_list&buildername=build-ics&limit="+this.numbuilds.value,
		       handleAs:"json",
		       load: dojo.hitch(this,this.gotStats)
		   });
	       },
	       gotStats: function(d) {
		   console.log(d);
		   /* JSON information */
		   var sites = { };
		   var max_delay = 0;
		   var site = 0;
		   var date, finishdate;
		   var waittime, buildtime;
		   var hour, finishhour;
		   var sites_data = [];
		   var o,i,j; // iterators
		   this.progress_dialog.destroy();
		   for(i =0 ;i < d.length; i+=1) {
		       if (d[i].buildrequests_complete) {
			   date = ts2date(d[i].buildrequests_submitted_at);
			   finishdate = ts2date(d[i].builds_finish_time);
			   site = d[i].preferred_site;
			   hour = date.getHours();
			   finishhour = finishdate.getHours();
			   maybe_init(sites, site,
				      {
					  site:site,
					  long_builds:[],
					  long_builds_numbers:[],
					  waittimes: [],
					  buildtimes: [],
					  by_hour_waitqueue: {},
					  by_hour_waittime: {},
					  by_hour_buildtime: {}
				      });
			   waittime = (d[i].builds_finish_time - d[i].buildrequests_submitted_at)/3600.0;
			   buildtime = (d[i].builds_finish_time - d[i].builds_start_time)/3600.0;
			   if (waittime >0 && buildtime >0.03) { /* build > 3mn to exclude obviously failing builds */
			       sites[site].buildtimes.push(buildtime);
			       sites[site].waittimes.push(waittime);
			   }
			   if (buildtime > 1) {
			       sites[site].long_builds.push(d[i].builds_number+":"+formatTime(buildtime));
			       sites[site].long_builds_numbers.push(d[i].builds_number);
			   }
		       }
		   }
		   d.sort(function(a,b) {
		       return (b.builds_finish_time - b.builds_start_time)-(a.builds_finish_time - a.builds_start_time);
		   });
		   var builds = [];
		   for(i =0 ;i < d.length; i+=1) {
		       if(d[i].buildrequests_complete) {
			   builds.push(d[i].builds_number);
		       }
		   }
		   for (site in sites) {
		       if (sites.hasOwnProperty(site)) {
			   sites_data.push(sites[site]);
		       }
		   }
		   sites_data.sort_by_attrib("site");
		   var PieAction = declare(PlotAction, {
		       constructor: function(chart, plot, callback){
			   this.callback = callback;
			   this.connect();
		       },
		       process: function(o){
			   if(o.shape && o.type === "onclick" || o.type === "onmouseover"){
			       this.callback(o.index, o.type === "onclick");
			   }
		       }
		   });
		   this.store.setData(sites_data);
		   this.store.notify();
		   ready(dojo.hitch(this, function() {
		       var Label = function(index){
			   if ((index >0) && index <= sites_data.length) {
			       try {
				   return sites_data[index-1].site;
			       }catch (err){}
			   }
			   return "";
		       };
		       var theme1 = new Theme({
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
		       });
		       function genCandle(list, label, long_builds) {
			   var m = list.min();
			   var M = list.max();
			   var a = list.avg();
			   var ret =  {low:m,
				       high:M,
				       open:a-0.1,
				       close:a+0.1,
				       tooltip:label+"<br>Min:"+formatTime(m)+"<br/>Max:"+formatTime(M)+"<br/>Avg:"+formatTime(a)+"<br/>"+long_builds.join("<br/>")
				      };
			   return ret;
		       }
		       var chart1_data2 = new StoreSeries(this.store, {}, function(item){
			   return genCandle(item.waittimes,"Wait Time", item.long_builds);
		       });
		       var chart1 = new Chart(this.chart1).
			   setTheme(theme1).
			   addAxis("x", { majorTickStep: 1, minorTicks: false, labelFunc: Label, minorLabels: false,rotation:-70}).
			   addAxis("y", { vertical: true, fixLower: "major", fixUpper: "major", includeZero: true, leftBottom: false , title: "Wait Time" }).
			   addPlot("waitTimes", {type: Candlesticks, maxBarSize:15, vAxis: "y", stroke: {color:"green"}, fill: "#2a6ead", animate: true}).
			   addSeries("data2", chart1_data2, { plot: "waitTimes"});
		       this.chart1.chart = chart1;
		       var ign = new Tooltip(chart1, "waitTimes");
		       chart1.render();
		       this.buildtable = new BuildsTable({buildnumbers:builds, node:this.builds});
		   }));
	       }});
       });
