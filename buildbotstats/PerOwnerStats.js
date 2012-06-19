define(["dojo/_base/declare", "buildbotstats/StatsBase", "dojo/dom-style", "dojo/ready", "dojox/charting/Chart",
	"dojox/charting/StoreSeries",
	"dojox/charting/axis2d/Default", "dojox/charting/plot2d/Columns", "dojox/charting/plot2d/Lines",
	"dojox/charting/plot2d/Pie", "dojox/charting/plot2d/Grid","dojox/charting/plot2d/StackedColumns",
	"dojox/charting/action2d/Tooltip", "dojox/charting/action2d/Highlight", "dojox/charting/plot2d/MarkersOnly", "dijit/form/NumberSpinner","dijit/form/Button","dijit/form/MultiSelect",
	"dojox/charting/widget/Chart2D","dijit/layout/BorderContainer","dijit/layout/ContentPane", "dijit/form/CheckBox",
	"dojo/text!./templates/perownerstats.html"],
       function(declare, StatsBase, domStyle, ready, Chart, StoreSeries,
		Default, Columns, Lines, Pie, Grid,
		StackedColumns, Tooltip, Highlight, markers, NumberSpinner, Button, MultiSelect, Chart2D,
		BorderContainer, ContentPane, CheckBox,
		template){
	   "use strict";
	    if (dojo.isIE <10) {
		template = "<div>Please use a html5 capable browser (Recent Chrome or Firefox)</div>";
	    }
	   return declare("buildbotstats.PerOwnerStats", [StatsBase], {

	       templateString: template,
	       generateCharts: function(){
		   if (!this.builderbranch.isValid() || !this.numbuilds.isValid()) {
		       return;
		   }
		   if(typeof(this.chart1.chart)!=='undefined') {
		       this.additionnal_plots.style.visibility =  "hidden";
		       this.chart1.chart.destroy();
		       this.chart2.chart.destroy();
		       this.chart3.chart.destroy();
		       this.chart4.chart.destroy();
		       this.chart5.chart.destroy();
		   }
		   this.get_stats(this.builderbranch.value, this.buildertype.value, ["owner","force_build_changeids"], this.numbuilds.value).then(
		       dojo.hitch(this,this.gotStats)
		   );
	       },
	       gotStats: function(d) {
		   this.help_message.style.visibility =  "visible";
		   /* JSON information */
		   var owners = { };
		   var max_delay = 0;
		   var min_day = d[d.length-1].buildrequests_submitted_at;
		   var max_day = 0;
		   var day = 0;
		   var owners_data = [];
		   var max_tot = 0;
		   var max_patches = 0;
		   // alias utility functions
		   var _int = this._int;
		   var maybe_init = this.maybe_init;
		   var o,i; // iterators
		   for(i =0 ;i < d.length; i+=1) {
		       if (d[i].buildrequests_complete) {
			   var name = d[i].prop_owner;
			   var changeids = [];
			   day = d[i].buildrequests_submitted_at;
			   maybe_init(owners, name,  {patches:{}, delays:{}, by_days_delays:{},by_days_patches:[], tot:0, name:name, builds:[], by_patchlist_builds:{}});
			   o = owners[name];
			   /* work around issue when too many changes in a build, does not fit in SQL entry */
			   if (d[i].prop_force_build_changeids !== "value too large") {
			       changeids = d[i].prop_force_build_changeids;
			   }
			   for (var j = 0; j< changeids.length; j+=1) {
			       o.patches[changeids[j]] = 1;
			   }
			   var time = _int(this.ts2hour(d[i].builds_finish_time - d[i].buildrequests_submitted_at));
			   this.increment_stat(o, "tot");
			   this.increment_stat_with_meta(o.by_patchlist_builds, changeids.join(", "),
						   d[i].buildrequests_buildername+"/"+d[i].builds_number);
			   if (time >=0 ) {
			       o.builds.push({
				   y:this.ts2hour(d[i].builds_finish_time - d[i].buildrequests_submitted_at),
				   x:day
			       });
			       o.by_days_patches.push({
				   y:changeids.length,
				   x:day
			       });
			       this.increment_stat(o.delays, time);
			       maybe_init(o.by_days_delays, day, {});
			       this.increment_stat(o.by_days_delays[day], time);
			       if (time > max_delay) {
				   max_delay = time;
			       }
			   }
		       }
		   }
		   for (o in owners) {
		       if (owners.hasOwnProperty(o)) {
			   var item = owners[o];
			   item.patches = Object.keys(item.patches);
			   if (item.tot>max_tot) {
			       max_tot = item.tot;
			   }
			   if (item.patches.length> max_patches) {
			       max_patches = item.patches.length;
			   }
			   owners_data.push(item);
		       }
		   }
		   owners_data.sort(function(a,b) { return b.tot - a.tot;});
		   owners_data = owners_data.splice(0,20);
		   this.store.setData(owners_data);
		   this.store.notify();
		   ready(dojo.hitch(this, function() {
		       var Label = function(index){
			   if ((index >0) && index <= owners_data.length) {
			       try {
				   return owners_data[index-1].name.split(",")[0];
			       }catch (err){}
			   }
			   return "";
		       };
		       var stats = this;
		       var WWLabel = function(index,val){
			   return stats.formatDate(stats.ts2date(val));
		       };
		       var chart1_data1 = new StoreSeries(this.store, {}, function(item){
			   return {y:item.tot,tooltip:item.name+":"+item.tot+"builds"};
		       });
		       var chart1_data2 = new StoreSeries(this.store, {}, function(item){
			   return {y:item.patches.length,tooltip:item.name+":"+item.patches.length+" patches<br>\n"+item.patches.join(", ")};
		       });
		       var chart1_data2_title = "numPatches";
		       if (this.duplicated_builds.checked) {
			   chart1_data2 = new StoreSeries(this.store, {}, function(o){
			       var duplicated_builds = [];
			       var i;
			       for (i in o.by_patchlist_builds) {
				   if (o.by_patchlist_builds.hasOwnProperty(i)){
				       if (o.by_patchlist_builds[i].length>1) {
					   duplicated_builds = duplicated_builds.concat(o.by_patchlist_builds[i]);
				       }
				   }
			       }
			       return {y:duplicated_builds.length,tooltip:o.name+":"+duplicated_builds.length+" duplicated builds<br>\n"+duplicated_builds.join("<br> ")};
			   });
			   chart1_data2_title = "numDuplicated";
		       }
		       var chart1 = new Chart(this.chart1,{ margins: {b:50} }).
			   setTheme(this.theme1).
			   addAxis("x", { majorTickStep: 1, minorTicks: false, labelFunc: Label, minorLabels: false,rotation:-45,font: "normal normal 10pt Tahoma"}).
			   addAxis("y", { vertical: true, fixLower: "major", fixUpper: "major", includeZero: true, leftBottom: false, majorTickStep: max_tot/20, max: max_tot*1.2, title: "NumBuilds" }).
			   addAxis("ry", { vertical: true, fixLower: "major", fixUpper: "major", includeZero: true, title: chart1_data2_title  }).
			   addPlot("numPatches", {type: "Columns", gap: 20, vAxis: "ry", stroke: {color:"white"}, fill: "yellow", animate: true}).
			   addPlot("numBuilds", {type: "Columns", gap: 5, vAxis: "y", stroke: {color:"white"}, fill: "#2a6ead", animate: true}).
			   addSeries("data1", chart1_data1, { plot: "numBuilds"}).
			   addSeries("data2", chart1_data2, { plot: "numPatches"});
		       this.chart1.chart = chart1;
		       var chart2 = new Chart(this.chart2,{ fill: null, margins: {t:0, l:0, b:0, r:0} }).
			   setTheme(this.theme2).
			   addPlot("delays", {type: "Pie", radius: 90, stroke: "white"}).
			   addSeries("data", [], {plot: "delays"});
		       var chart3 = new Chart(this.chart3,{ fill: null, margins: {t:0, l:0, b:20, r:0} }).
			   setTheme(this.theme2).
			   // need fake title to give enough space for labels
			   addAxis("x", { minorTickStep: 24*3600, labelFunc: WWLabel,rotation:-45,font: "normal normal 10pt Tahoma"}).
			   addAxis("y", {vertical: true,title:"build delay"}).
			   addPlot("delays", {type: markers}).
			   addSeries("delay", [], {plot: "delays"});
		       var chart4 = new Chart(this.chart4,{ fill: null, margins: {t:0, l:0, b:20, r:0} }).
			   setTheme(this.theme2).
			   // need fake title to give enough space for labels
			   addAxis("x",{  minorTickStep: 24*3600,rotation:-45,labelFunc: WWLabel,font: "normal normal 10pt Tahoma"}).
			   addAxis("y", {vertical: true,title:"num patches per build"}).
			   addPlot("patches", {type: markers}).
			   addSeries("patches", [], {plot: "patches"});
		       var chart5 = new Chart(this.chart5,{ fill: null, margins: {t:0, l:0, b:0, r:0} }).
			   setTheme(this.theme2).
			   // need fake title to give enough space for labels
			   addAxis("x",{  minorLabels: false, title:" "}).
			   addAxis("y", {vertical: true, min:0, minorLabels: false,title:"num builds per patch list"}).
			   addPlot("builds", {type: markers}).
			   addSeries("builds", [], {plot: "builds"});
		       this.chart1.chart = chart1;
		       this.chart2.chart = chart2;
		       this.chart3.chart = chart3;
		       this.chart4.chart = chart4;
		       this.chart5.chart = chart5;
		       var ign = new Tooltip(chart1, "numBuilds");
		       ign = new Tooltip(chart5, "builds");
		       ign = new Tooltip(chart1, "numPatches");
		       ign = new Tooltip(chart3, "delays");
		       ign = new Highlight(chart1, "numBuilds");
		       ign = new Highlight(chart1, "numPatches");
		       ign = new this.PieAction(chart1, "numBuilds", dojo.hitch(this, function(index, clicked){
			   if(!clicked) {
			       return;
			       }
			   // show up a PieChart with the month split by world region
			   var d = [];
			   var o = this.store.data[index];
			   for (var i in o.delays) {
			       if (o.delays.hasOwnProperty(i)){
				   d.push( { y: o.delays[i], text: "<"+(_int(i)+1)+"h" });
			       }
			   }
			   chart2.updateSeries("data", d);
			   console.log(o.builds, o.by_days_patches);
			   chart3.updateSeries("delay", o.builds);
			   chart4.updateSeries("patches", o.by_days_patches);
			   d = [];
			   var n = 0;
			   for (i in o.by_patchlist_builds) {
			       if (o.by_patchlist_builds.hasOwnProperty(i)){
				   if (o.by_patchlist_builds[i].length>1) {
				       d.push({
					   y: o.by_patchlist_builds[i].length,
					   x: n, tooltip:i+"<br/>"+o.by_patchlist_builds[i].join("<br/>")});
				       n+=1;
				   }
			       }
			   }
			   chart5.updateSeries("builds", d);
			   chart2.render();
			   chart3.render();
			   chart4.render();
			   chart5.render();
			   // in case it was hidden and we clicked
			   this.additionnal_plots.style.visibility =  "visible";
			   this.help_message.style.visibility =  "hidden";
		       }));

		       chart1.render();
		   }));
	       }});
       });
