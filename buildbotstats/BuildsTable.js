define([
    "dgrid/List",
    "dgrid/OnDemandGrid",
    "dgrid/Selection",
    "dgrid/Keyboard",
    "dgrid/extensions/ColumnHider",
    "dojo/_base/declare",
    "dojo/_base/array",
    "buildbotstats/BuildbotJsonStore"
], function(List, Grid, Selection, Keyboard, Hider, declare, arrayUtil, BuildbotJsonStore){
    "use strict";
   return declare("buildbotstats.BuildsTable", [], {
       node:"BuildsTable",
       buildername:"build-ics",
       buildnumbers:[],
	// The constructor
	constructor: function(args){
            declare.safeMixin(this,args);
	    this.store = new BuildbotJsonStore( {target:"/absp/json/builders/"+this.buildername+"/builds", buildnumbers:this.buildnumbers});
	    this.grid = new (declare([Grid, Selection, Keyboard, Hider]))({
                loadingMessage: "loading...",
		store: this.store,
		minRowsPerPage: 15,
		maxRowsPerPage: 15,
		columns: {
		    Name: "Builder Name",
		    Number: "Build Number",
		    RepoTime: "Repo Time",
		    BuildTime: "Build Time",
		    SlaveName: "Slave Name"
		}
	    }, this.node);
	    this.grid.refresh();
	    this.grid.on(".dgrid-row:dblclick", dojo.hitch(this, this.rowDblClick));
	    this.grid.on("dgrid-select", dojo.hitch(this, this.select));

	},
       select: function(event) {
	   var _this = this;
	   if (this.withSelect) {
	       this.withSelect(arrayUtil.map(event.rows, function(row){ return _this.store.get(row.id); }));
	   }
       },
       rowDblClick : function(evt) {
	   var buildnumber = this.buildnumbers[this.grid.row(evt).id];
	   window.open('/absp/builders/'+this.buildername+"/builds/"+buildnumber,'_newtab');
       },
       destroy: function() {
	   this.grid.domNode.innerHTML = "";
	   this.grid.domNode = undefined;
	   this.grid.destroy();
       }
    });
});
