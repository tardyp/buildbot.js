define(["dojo/_base/declare", "buildbotstats/StatsBase", "dojo/dom-style", "dojo/ready", "dojox/charting/Chart",
	"dojox/charting/StoreSeries",
	"dojox/charting/axis2d/Default", "dojox/charting/plot2d/Columns", "dojox/charting/plot2d/Lines",
	"dojox/charting/plot2d/Pie", "dojox/charting/plot2d/Grid","dojox/charting/plot2d/StackedColumns","dojox/charting/plot2d/Candlesticks",
	"dojox/charting/action2d/Tooltip", "dojox/charting/action2d/Highlight", "dojox/charting/plot2d/MarkersOnly", "dijit/form/NumberSpinner","dijit/form/Button","dijit/form/MultiSelect",
	"dojox/charting/widget/Chart2D","dijit/layout/BorderContainer","dijit/layout/ContentPane", "dijit/form/CheckBox","buildbotstats/BuildsTable",
	"dojo/text!./templates/persitestats.html"],
       function(declare, StatsBase, domStyle, ready, Chart, StoreSeries,
		Default, Columns, Lines, Pie, Grid,
		StackedColumns, Candlesticks, Tooltip, Highlight, markers, NumberSpinner, Button, MultiSelect, Chart2D,
		BorderContainer, ContentPane, CheckBox, BuildsTable,
		template){
	   "use strict";
	    if (dojo.isIE <10) {
		template = "<div>Please use a html5 capable browser (Recent Chrome or Firefox)</div>";
	    }
	   return declare("buildbotstats.PerSiteStats", [StatsBase], {
	       templateString: template,

	       generateCharts: function(){
		   if (!this.numbuilds.isValid()) {
		       return;
		   }
		   if(typeof(this.buildtable)!=='undefined') {
		       this.chart1.chart.destroy();
		       this.slaves.chart.destroy();
		       this.buildtable.destroy();
		       this.buildtable = undefined;
		   }
		   this.get_stats("", ["build-ics"], ["preferred_site","force_build_clean","variant_list"], this.numbuilds.value).then(
		       dojo.hitch(this,this.gotStats)
		   );
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
			   date = this.ts2date(d[i].buildrequests_submitted_at);
			   finishdate = this.ts2date(d[i].builds_finish_time);
			   site = d[i].prop_preferred_site;
			   hour = date.getHours();
			   finishhour = finishdate.getHours();
			   this.maybe_init(sites, site,
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
			   waittime = this.ts2hour((d[i].builds_finish_time - d[i].buildrequests_submitted_at));
			   buildtime = this.ts2hour(d[i].builds_finish_time - d[i].builds_start_time);
			   if (waittime >0 && buildtime > this.min_build_time) { /* build > 3mn to exclude obviously failing builds */
			       sites[site].buildtimes.push(buildtime);
			       sites[site].waittimes.push(waittime);
			   }
			   if (buildtime > 1) {
			       sites[site].long_builds.push(d[i].builds_number+":"+this.formatTime(buildtime));
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
		   this.store.setData(sites_data);
		   this.store.notify();
		   var formatTime = this.formatTime;
		   ready(dojo.hitch(this, function() {
		       var Label = function(index, val){
			   if ((index >0) && index <= sites_data.length) {
			       try {
				   return sites_data[index-1].site;
			       }catch (err){}
			   }
			   return "";
		       };

		       var chart1_data2 = new StoreSeries(this.store, {}, dojo.hitch(this,function(item){
			   return this.genCandle(item.waittimes,"Wait Time", item.long_builds);
		       }));
		       var chart1 = new Chart(this.chart1).
			   setTheme(this.theme1).
			   addAxis("x", { majorTickStep: 1, minorTicks: false, labelFunc: Label, minorLabels: false,rotation:-45,font: "normal normal 10pt Tahoma"}).
			   addAxis("y", { vertical: true, fixLower: "major", fixUpper: "major", includeZero: true, leftBottom: false , title: "Wait Time" }).
			   addPlot("waitTimes", {type: Candlesticks, maxBarSize:15, vAxis: "y", stroke: {color:"green"}, fill: "#2a6ead", animate: true}).
			   addSeries("data2", chart1_data2, { plot: "waitTimes"});
		       this.chart1.chart = chart1;
		       var ign = new Tooltip(chart1, "waitTimes");
		       chart1.render();
		       this.buildtable = new BuildsTable({buildnumbers:builds, node:this.builds, withSelect:dojo.hitch(this, this.createSlaveChart)});

		   }));
	       },
	       createSlaveChart: function(data) {
		   var plotdata = [];
		   var plotdata2 = [];
		   var slavelist = [];
		   var x;
		   if (data.length<2) {
		       return;
		   }
		   if (this.slaves.chart) {
		       this.slaves.chart.destroy();
		   }
		   function unFormatTime(x){
		       var h = parseInt(x.split("h")[0],10);
		       var mn = parseInt(x.split("h")[1].split("mn")[0],10);
		       return h+mn/60.0;
		   }
		   for (var i=0; i < data.length; i+=1) {
		       x = slavelist.indexOf(data[i].SlaveName);
		       if ( x < 0 ) {
			   slavelist.push(data[i].SlaveName);
			   x = slavelist.length-1;
		       }
		       plotdata.push({x:x,y:unFormatTime(data[i].BuildTime)});
		       plotdata2.push({x:x,y:unFormatTime(data[i].RepoTime)});
		   }
		   function Label(index){
		       if ((index >=0) && index <= slavelist.length) {
			   try {
			       return slavelist[index];
			   }catch (err){}
		       }
		       return "";
		   }
		   var chart5 = new Chart(this.slaves,{ fill: null, margins: {t:0, l:0, b:100, r:0} }).
		       setTheme(this.theme2).
		       // need fake title to give enough space for labels
		       addAxis("x", { majorTickStep: 1, minorTicks: false, labelFunc: Label, minorLabels: false,rotation:-45,font: "normal normal 10pt Tahoma"}).
		       addAxis("y", {vertical: true, min:0,title:"duration (yellow: repo, blue: build)"}).
		       addPlot("repo", {type: markers}).
		       addPlot("builds", {type: markers}).
		       addSeries("repo", plotdata2, {plot: "builds",stroke: {color:"black"},fill:"yellow"}).
		       addSeries("builds", plotdata, {plot: "builds",stroke: {width:10}});
		   this.slaves.chart = chart5;
		   chart5.render();
	       }
	   });
       });
