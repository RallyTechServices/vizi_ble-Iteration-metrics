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
        this.logger.setSaveForLater(this.getSetting('saveLog'));
//        this.setLoading("Loading stuff...");

        this.down('#selector_box').add({
            xtype: 'rallydatefield',
            itemId: 'end_date',
            fieldLabel: 'Select Iterations Ending Before:',
            labelAlign: 'left',
            labelWidth: 175,
            width: 275,
            labelSeparator: '',
            margin: '10 10 10 10',
//            defaultAlign: 'right',
//            name: 'end_date',
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

//        this._getValidProjects();
    },

    _getValidProjects: function() {
        var me = this;

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
//me.logger.log("P Fetched:",projects);

//              Ext.Array.each(projects, function(project) {
                me._getIterations(projects);
            },

//me.logger.log("iterations:",iterations);
                failure: function(msg) {
                    Ext.Msg.alert('',msg);
                },
                scope: this
            }).always(function(){ me.setLoading(false);})

    },

    _getIterations: function(projects) {
        var me = this;
        var promises = [];
        var records = [];

        Ext.Array.each(projects, function(project) {
          promises.push(function() {
            return me._getIterationsforProject(project);
          });
        });
        Deft.Chain.sequence(promises, this).then ({
            success: function(record) {

            records.push(record);
            records = Ext.Array.flatten(records);

//me.logger.log("records:",records);
        var fields = ['Team Name','Last Iteration','Iteration -1','Iteration -2','Iteration -3','Iteration -4','Iteration -5'];
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

me.logger.log("end date:",endDate);
//me.logger.log("project:",project.data.Name);

      var iteration_config = {
            model: 'Iteration',
            fetch: [
                'Name',
                'ObjectID',
                'StartDate',
                'EndDate',
                'PlanEstimate',
                'Project'
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
                var record = {};
                var numgot = iterations.length;
                if (numgot == 0) {record = {};}

                record = {
                    "Team Name": iterations[0].data.Project.Name,
                    "Last Iteration": iterations[0].data.PlanEstimate,
                };
                for (var i = 1;  i < numgot; i++) {
                    record["Iteration -" + i] = iterations[i].data.PlanEstimate;
                }

me.logger.log("record",record);

                deferred.resolve(record);
//                me._getIterationFlow(iteration);
                },

              failure: function(error_message){
                  deferred.reject(error_message);
              }
              }).always(function() {
              });

      return deferred.promise;
    },

    _getIterationFlow: function() {
      var me = this;
      var deferred = Ext.create("Deft.Deferred");
me.logger.log("GIFP:");
      var iteration_config = {
            model: 'IterationCumulativeFlowData',
            fetch: [
                'Name',
                'ObjectID',
                'StartDate',
                'EndDate',
                'PlanEstimate',
                'PlannedVelocity',
                'Project',
                'c_IncludeinMonthlyReport'
                ],
            filters: [
              {property:'EndDate', operator: '<=', value: '2017-11-30'},
//              {property:'Project.c_IncludeinMonthlyReport', operator: '=', value: true}
            ],
            limit: 6,
            pageSize: 6,
            sorters: [
//                {property:'Project.Name', direction:'ASC'},
                {property:'EndDate', direction:'DESC'}
                ],
            context: {
//                project: 'https://us1.rallydev.com/slm/webservice/v2.0/project/20150591812',
//                projectScopeUp: false,
//                projectScopeDown: true
            }
        };

        me._loadWsapiRecords(iteration_config).then({
              scope: this,
              success: function(iterations) {
                deferred.resolve(me._getIterationFlow(iterations));
              },
              failure: function(error_message){
                  alert(error_message);
              }
              }).always(function() {
              });

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
me.logger.log("records",records);
        var cols = Ext.Array.map(field_names, function(name){
            return { dataIndex: name, text: name, flex: 1 };
        });
me.logger.log("columns",cols);
        this.down('#grid_box1').add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: cols
        });
    },

    _export: function(){
//        var file_util = Ext.create('Rally.technicalservices.FileUtilities',{});
//        var csv = file_util.convertDataArrayToCSVText(this.gridRows, this.export_columns);
//        var export_file_name = this.getContext().getProject().Name + "_" + this.start_rls.getRecord().get('Name') + "_" + this.end_rls.getRecord().get('Name') + ".csv"
//        file_util.saveCSVToFile(csv, export_file_name);
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
