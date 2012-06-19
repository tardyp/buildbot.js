define(["dojo/_base/declare", "buildbotstats/PerSiteStats", "dojo/dom-style", "dojo/ready", "dojox/charting/Chart",
	"dojox/charting/StoreSeries",
	"dojox/charting/axis2d/Default", "dojox/charting/plot2d/Columns", "dojox/charting/plot2d/Lines",
	"dojox/charting/plot2d/Pie", "dojox/charting/plot2d/Grid","dojox/charting/plot2d/StackedColumns","dojox/charting/plot2d/Candlesticks",
	"dojox/charting/action2d/Tooltip", "dojox/charting/action2d/Highlight", "dojox/charting/plot2d/MarkersOnly", "dijit/form/NumberSpinner","dijit/form/Button","dijit/form/MultiSelect",
	"dojox/charting/widget/Chart2D","dijit/layout/BorderContainer","dijit/layout/ContentPane", "dijit/form/CheckBox",
	"dojo/text!./templates/perdaystats.html"],
       function(declare, StatsBase, domStyle, ready, Chart, StoreSeries,
		Default, Columns, Lines, Pie, Grid,
		StackedColumns, Candlesticks, Tooltip, Highlight, markers, NumberSpinner, Button, MultiSelect, Chart2D,
		BorderContainer, ContentPane, CheckBox,
		template){
	   "use strict";
	   if (dojo.isIE <10) {
	       template = "<div>Please use a html5 capable browser (Recent Chrome or Firefox)</div>";
	   }
	   return declare("buildbotstats.PerDayStats", [StatsBase], {
	       //	get our template
	       templateString: template,
	       generateCharts: function(){
		   document.perownerstat=this; /* for debug */
		   if (!this.numbuilds.isValid()) {
		       return;
		   }
		   if(typeof(this.chart1.chart)!=='undefined') {
		       this.additionnal_plots.style.visibility =  "hidden";
		       this.chart1.chart.destroy();
		       this.chart3.chart.destroy();
		       this.chart4.chart.destroy();
		       this.chart5.chart.destroy();
		   }
		   this.get_stats("", ["build-ics"], ["preferred_site","force_build_clean","variant_list"], this.numbuilds.value).then(
		       dojo.hitch(this,this.gotStats)
		   );
	       },
	       gotStats: function(d) {
		   this.help_message.style.visibility =  "visible";
		   /* JSON information */
		   var days = { };
		   var max_delay = 0;
		   var day = 0, finishday;
		   var date, finishdate;
		   var waittime, buildtime;
		   var hour, finishhour;
		   var days_data = [];
		   var o,i,j; // iterators
		   var _this = this;
		   this.progress_dialog.destroy();
		   var initForDay = function(day) {
		       _this.maybe_init(days, day,{
			   day:day,
			   long_builds:[],
			   waittimes: [],
			   buildtimes: [],
			   by_hour_waitqueue: {},
			   by_hour_waittime: {},
			   by_hour_buildtime: {}
		       });
		   };
		   for(i =0 ;i < d.length; i+=1) {
		       if (d[i].buildrequests_complete) {
			   date = this.ts2date(d[i].buildrequests_submitted_at);
			   finishdate = this.ts2date(d[i].builds_finish_time);
			   day = this.formatDate(date);
			   finishday = this.formatDate(finishdate);
			   hour = date.getHours();
			   finishhour = finishdate.getHours();
			   initForDay(day);
			   waittime = this.ts2hour(d[i].builds_finish_time - d[i].buildrequests_submitted_at);
			   buildtime = this.ts2hour(d[i].builds_finish_time - d[i].builds_start_time);
			   if (waittime >0 && buildtime > this.min_build_time) { /* build > 3mn to exclude obviously failing builds */
			       days[day].waittimes.push(waittime);
			       days[day].buildtimes.push(buildtime);
			       /* account the build as waiting for as many hour between start hour and end hour
				  This does not work when a build is crossing a day, which is not happening often enough
				  to be worth coding the corner case */
			       if (finishday === day) {
				   for (j = hour; j < finishhour; j+=1) {
				       this.increment_stat(days[day].by_hour_waitqueue, j);
				   }
			       } else { /* the case where the build cross a day (hopefully did not wait more than 24h..)*/
				   initForDay(finishday);
				   for (j = hour; j < 24; j+=1) {
				       this.increment_stat(days[day].by_hour_waitqueue, j);
				   }
				   for (j = 0; j < finishhour; j+=1) {
				       this.increment_stat(days[finishday].by_hour_waitqueue, j);
				   }
			       }
			       this.increment_stat_with_meta(days[day].by_hour_waittime, j, waittime);
			       this.increment_stat_with_meta(days[day].by_hour_buildtime, j, buildtime);
			       if (buildtime > 1) {
				   days[day].long_builds.push(d[i].builds_number+":"+this.formatTime(buildtime));
			       }
			   }
		       }
		   }
		   for (day in days) {
		       if (days.hasOwnProperty(day)) {
			   days_data.push(days[day]);
		       }
		   }
		   days_data.sort_by_attrib("day");
		   this.store.setData(days_data);
		   this.store.notify();
		   ready(dojo.hitch(this, function() {
		       var Label = function(index){
			   if ((index >0) && index <= days_data.length) {
			       try {
				   return days_data[index-1].day;
			       }catch (err){}
			   }
			   return "";
		       };
		       var chart1_data1 = new StoreSeries(this.store, {}, dojo.hitch(this, function(item){
			   return this.genCandle(item.waittimes, "Wait Time", []);
		       }));
		       var chart1_data2 = new StoreSeries(this.store, {}, dojo.hitch(this, function(item){
			   return this.genCandle(item.buildtimes,"Build Time", item.long_builds);
		       }));
		       var chart1 = new Chart(this.chart1).
			   setTheme(this.theme1,{ margins: {b:50} }).
			   addAxis("x", { majorTickStep: 1, minorTicks: false, labelFunc: Label, minorLabels: false,rotation:-45,font: "normal normal 10pt Tahoma"}).
			   addAxis("y", { vertical: true, fixLower: "major", fixUpper: "major", includeZero: true, leftBottom: false , title: "time" }).
			   addPlot("waitTimes", {type: Candlesticks,maxBarSize:15, vAxis: "y", stroke: {color:"red"}, fill: "yellow", animate: true}).
			   addPlot("buildTimes", {type: Candlesticks, maxBarSize:15, vAxis: "y", stroke: {color:"green"}, fill: "#2a6ead", animate: true}).
			   addSeries("data1", chart1_data1, { plot: "waitTimes"}).
			   addSeries("data2", chart1_data2, { plot: "buildTimes"});
		       this.chart1.chart = chart1;
		       var build_time = this.build_time;
		       function update_chart()
		       {
			   if (!build_time.checked) {
			       chart1.updateSeries("data1", chart1_data1);
			       chart1.updateSeries("data2", []);
			   } else {
			       chart1.updateSeries("data1", []);
			       chart1.updateSeries("data2", chart1_data2);
			   }
			   chart1.render();
		       }
		       build_time.onClick = update_chart;
		       update_chart();
		       var chart3 = new Chart(this.chart3,{ fill: null, margins: {t:0, l:0, b:0, r:0} }).
			   setTheme(this.theme2).
			   addAxis("x",{  minorLabels: false,majorTickStep: 2,min:0,max:23, title:" "}).
			   addAxis("y", {vertical: true,title:"build delay"}).
			   addPlot("waittime", {type: Candlesticks}).
			   addSeries("waittime", [], {plot: "waittime"});
		       var chart4 = new Chart(this.chart4,{ fill: null, margins: {t:0, l:0, b:0, r:0} }).
			   setTheme(this.theme2).
			   // need fake title to give enough space for labels
			   addAxis("x",{minorLabels:false,majorTickStep: 2,min:0,max:23, title:" "}).
			   addAxis("y", {vertical: true,max:2,title:"build time"}).
			   addPlot("buildtime", {type: Candlesticks}).
			   addSeries("buildtime", [], {plot: "buildtime"});
		       var chart5 = new Chart(this.chart5,{ fill: null, margins: {t:0, l:0, b:0, r:0} }).
			   setTheme(this.theme2).
			   // need fake title to give enough space for labels
			   addAxis("x",{minorLabels:false,majorTickStep: 2,min:0,max:23, title:" "}).
			   addAxis("y", {vertical: true, min:0, minorLabels: false,title:"wait queue"}).
			   addPlot("waitq", {type: markers}).
			   addSeries("waitq", [], {plot: "waitq"});
		       this.chart1.chart = chart1;
		       this.chart3.chart = chart3;
		       this.chart4.chart = chart4;
		       this.chart5.chart = chart5;
		       var ign = new Tooltip(chart1, "waitTimes");
		       ign = new Tooltip(chart5, "waitq");
		       ign = new Tooltip(chart1, "buildTimes");
		       ign = new Tooltip(chart3, "waittime");
		       ign = new Tooltip(chart4, "buildtime");
		       ign = new Highlight(chart1, "waitTimes");
		       ign = new Highlight(chart1, "buildTimes");
		       var clicked = dojo.hitch(this, function(index, clicked) {
			   var day = this.store.data[index];
			   function process_data(data, label, gen) {
			       var i;
			       var d = [];
			       for (i in data) {
				   if (data.hasOwnProperty(i)){
				       var candleItem = gen(data[i], label, []);
				       candleItem.x = i;
				       d.push(candleItem);
				   }
			       }
			       d.sort_by_attrib("x");
			       return d;
			   }
			   function genSimple(item) {
			       return { y:item};
			   }
			   chart3.updateSeries("waittime",
					       process_data(day.by_hour_waittime, "waittime", dojo.hitch(this,this.genCandle)));
			   chart4.updateSeries("buildtime",
					       process_data(day.by_hour_buildtime, "buildtime",dojo.hitch(this,this.genCandle)));
			   chart5.updateSeries("waitq",
					       process_data(day.by_hour_waitqueue, "waitqueue",genSimple));
			   chart3.render();
			   chart4.render();
			   chart5.render();
			   // in case it was hidden and we clicked
			   this.additionnal_plots.style.visibility =  "visible";
			   this.help_message.style.visibility =  "hidden";
		       });
		       ign = new this.PieAction(chart1, "waitTimes", clicked);
		       ign = new this.PieAction(chart1, "buildTimes", clicked);
		       chart1.render();
		   }));
	       }
	   });
       });
