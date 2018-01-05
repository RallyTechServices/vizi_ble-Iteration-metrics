Ext.define("CArABU.app.IterMet", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new CArABU.technicalservices.Logger(),
    defaults: { margin: 10 },
//    layout: 'border',

    items: [
        {xtype:'container',itemId:'selector_box', layout: 'hbox'},
        {xtype:'container', itemId:'grid_box1'},
//        {xtype:'container',flex: 1, itemId:'grid_box1', region: 'west'},
//        {xtype:'container',flex: 1, itemId:'grid_box2', region: 'east'}
    ],

    integrationHeaders : {
        name : "CArABU.app.TSApp"
    },

    launch: function() {
        var me = this;
        var export_columns = [];
        var gridRows = [];

        this.logger.setSaveForLater(this.getSetting('saveLog'));

        this.down('#selector_box').add({
            xtype: 'rallydatefield',
            itemId: 'end_date',
            fieldLabel: 'Select Iterations Ending Before:',
            labelAlign: 'left',
            labelWidth: 175,
            width: 275,
            labelSeparator: '',
            margin: '10 10 10 10',
        });

        this.down('#selector_box').add({
            xtype: 'rallybutton',
            text: 'Go',
            margin: '10 10 10 10',
            defaultAlign: 'right',
            listeners: {
                click: this._getValidProjects,
                scope: this
            }
        });

        this.down('#selector_box').add({
            xtype: 'rallybutton',
            text: 'Export',
            margin: '10 10 10 10',
            defaultAlign: 'right',
            listeners: {
                scope: this,
                click: this._export
            }
        });

    },

    _getValidProjects: function() {
        var me = this;
//me.logger.log("getValidProjects");
        this.setLoading("Loading Projects...");

        var project_config = {
            model: 'Project',
            fetch: ['Name','ObjectID'],
            filters: [
              {property:"c_IncludeinMonthlyReport", operator: '=', value: true}
            ],
            sorters: [{property:'Name', direction:'ASC'}],
        };

        me._loadWsapiRecords(project_config).then({
              scope: this,
              success: function(projects) {
                me._getIterations(projects);
              },
              failure: function(msg) {
                Ext.Msg.alert('',msg);
              },
              scope: this
              }).always(function(){ me.setLoading(false);})
    },

    _getIterations: function(projects) {
        this.setLoading("Loading Iterations...");

        var me = this;
        var promises = [];
        var records = [];

//me.logger.log("getIterations");
        Ext.Array.each(projects, function(project) {
          promises.push(function() {
            return me._getIterationsforProject(project);
          });
        });
        Deft.Chain.sequence(promises, this).then ({
            success: function(record) {

            records.push(record);
            records = Ext.Array.flatten(records);

//me.logger.log("iteration get records:",records);
        var fields = [
            'Team Name',
            'Last Iteration Say/Do',
            'Iteration -1 Say/Do',
            'Iteration -2 Say/Do',
            'Iteration -3 Say/Do',
            'Iteration -4 Say/Do',
            'Iteration -5 Say/Do'
            ];

        me._displayGridGivenRecords(records,fields);

          },
          failure: function(error_message){
              alert(error_message);
          }
        });
    },

    _getIterationsforProject: function(project) {
      var deferred = Ext.create("Deft.Deferred");
      var me = this;
      var endDate = Rally.util.DateTime.toIsoString(Rally.util.DateTime.add(this.down('#end_date').getValue(),'day',1),true);
      this.endDate = endDate;
//me.logger.log("getIterationsforProject");
//me.logger.log("end date:",endDate);
//me.logger.log("project:",project.data.Name);

      var iteration_config = {
            model: 'Iteration',
            fetch: [
                'Name',
                'ObjectID',
                'StartDate',
                'EndDate',
                'PlanEstimate',
                'Project',
                ],
            filters: [
              {property:'EndDate', operator: '<=', value: endDate},
              {property:'Project.Name', operator: '=', value: project.data.Name },
            ],
            limit: 6,
            pageSize: 6,
            sorters: [
                {property:'EndDate', direction:'DESC'}
                ],
              context: {
                project: null
              }
        };

        me._loadWsapiRecords(iteration_config).then({

              scope: this,
              success: function(iterations) {
                var promises = [];
                var iterAccept = [];
                var drecord = {};

                var numgot = iterations.length;

                if (numgot == 0) {drecord = {};}

                Ext.Array.each(iterations, function(iteration) {
                      promises.push(function() {
                        return me._getIterationFlow(iteration);
                      });
                });
                Deft.Chain.sequence(promises, this).then ({
                    success: function(record) {
//me.logger.log("chain record",record);

                    iterAccept.push(record);
                    iterAccept = Ext.Array.flatten(iterAccept);

                    drecord = {
                        "Team Name": iterations[0].data.Project.Name,
                        "Last Iteration Say": iterations[0].data.PlanEstimate,
                        "Last Iteration Do": iterAccept[0].data.CardEstimateTotal,
                        "Last Iteration Say/Do":  iterations[0].data.PlanEstimate > 0 ? Math.round((iterAccept[0].data.CardEstimateTotal/iterations[0].data.PlanEstimate)*100) + "%" : "N/A",
                    };
                    for (var i = 1;  i < numgot; i++) {
                        drecord["Iteration -" + i + " Say"] = iterations[i].data.PlanEstimate;
                        drecord["Iteration -" + i + " Do"] = iterAccept[i].data.CardEstimateTotal;
                        drecord["Iteration -" + i + " Say/Do"] = iterations[i].data.PlanEstimate > 0 ? Math.round((iterAccept[i].data.CardEstimateTotal/iterations[i].data.PlanEstimate)*100) + "%" : "N/A";
                    }
//me.logger.log("record",drecord);

                deferred.resolve(drecord);
//me.logger.log("iteration flow records:",iterAccept);
//me.logger.log("record",drecord);

                  },
                  failure: function(error_message){
                      alert(error_message);
                  }
                });

              },

              failure: function(error_message){
                  deferred.reject(error_message);
              }
              }).always(function() {
              });

      return deferred.promise;
    },

    _getIterationFlow: function(iteration) {
      this.setLoading("Gathering and Calculating...");
      var me = this;
      var deferred = Ext.create("Deft.Deferred");

//me.logger.log("getIterationFlow", iteration);
      var iteration_config = {
            model: 'IterationCumulativeFlowData',
            fetch: [
                'IterationObjectID',
                'CardState',
                'CardEstimateTotal',
                'CreationDate',
                ],
            filters: [
              {property:'IterationObjectID', operator: '=', value: iteration.data.ObjectID},
              {property:'CardState', operator: '=', value: 'Accepted'},
            ],
            limit: 1,
            pageSize: 1,
            sorters: [
                {property:'CreationDate', direction:'DESC'}
                ],
              context: {
                project: null
              }

        };

        me._loadWsapiRecords(iteration_config).then({
              scope: this,
              success: function(record) {
//me.logger.log("flow record",record);
              deferred.resolve(record);
              },
              failure: function(error_message){
                  alert(error_message);
              }
              }).always(function() {
              });
      return deferred.promise;
    },

    _loadWsapiRecords: function(config) {
        var deferred = Ext.create('Deft.Deferred');
        var me = this;

        Ext.create('Rally.data.wsapi.Store', config).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },

    _processRecords: function() {
    },

    _displayGridGivenStore: function(store,field_names){
        this.down('#grid_box1').add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: field_names
        });
    },

    _displayGridGivenRecords: function(records,field_names){
        var me = this;
        this.setLoading(false);
        if ( this.down('#grid_box1') ) { this.down('#grid_box1').removeAll(); }
        var store = Ext.create('Rally.data.custom.Store',{
            data: records
        });
//me.logger.log("records",records);
        var cols = Ext.Array.map(field_names, function(name){
            return { dataIndex: name, text: name, flex: 1 };
        });
        var export_cols = {
             'Team Name':'Team Name',
             'Last Iteration Say': 'Last Iteration Say',
             'Last Iteration Do': 'Last Iteration Do',
             'Iteration -1 Say': 'Iteration -1 Say',
             'Iteration -1 Do': 'Iteration -1 Do',
             'Iteration -2 Say': 'Iteration -2 Say',
             'Iteration -2 Do': 'Iteration -2 Do',
             'Iteration -3 Say': 'Iteration -3 Say',
             'Iteration -3 Do': 'Iteration -3 Do',
             'Iteration -4 Say': 'Iteration -4 Say',
             'Iteration -4 Do': 'Iteration -4 Do',
             'Iteration -5 Say': 'Iteration -5 Say',
             'Iteration -5 Do': 'Iteration -5 Do'
        };
        this.export_columns = export_cols;
        this.gridRows = records;

//me.logger.log("erecord",this.export_columns);
//me.logger.log("grecord",this.gridRows);

//me.logger.log("columns",cols);
        this.down('#grid_box1').add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: cols,
            showRowActionsColumn: false,
            columnLines: true
        });
    },

    _export: function(){
//this.logger.log("erecord2",this.export_columns);
//this.logger.log("grecord2",this.gridRows);
        var file_util = Ext.create('Rally.technicalservices.FileUtilities',{});
        var csv = file_util.convertDataArrayToCSVText(this.gridRows, this.export_columns);
        var export_file_name = "Iteration Metrics - " + this.endDate + ".csv"
        file_util.saveCSVToFile(csv, export_file_name);
    },

    getSettingsFields: function() {
        var check_box_margins = '5 0 5 0';
        return [{
            name: 'saveLog',
            xtype: 'rallycheckboxfield',
            boxLabelAlign: 'after',
            fieldLabel: '',
            margin: check_box_margins,
            boxLabel: 'Save Logging<br/><span style="color:#999999;"><i>Save last 100 lines of log for debugging.</i></span>'

        }];
    },

    getOptions: function() {
        var options = [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];

        return options;
    },

    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }

        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{
            showLog: this.getSetting('saveLog'),
            logger: this.logger
        });
    },

    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    }

});
