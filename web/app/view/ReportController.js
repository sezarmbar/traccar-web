/*
 * Copyright 2015 - 2016 Anton Tananaev (anton@traccar.org)
 * Copyright 2016 Andrey Kunitsyn (andrey@traccar.org)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

Ext.define('Traccar.view.ReportController', {
    extend: 'Ext.app.ViewController',
    alias: 'controller.report',

    requires: [
        'Traccar.AttributeFormatter',
        'Traccar.model.Position',
        'Traccar.model.ReportTrip',
        'Traccar.view.ReportConfigDialog',
        'Traccar.store.ReportEventTypes'
    ],

    config: {
        listen: {
            controller: {
                '*': {
                    selectdevice: 'selectDevice'
                },
                'map': {
                    selectreport: 'selectReport'
                }
            }
        }
    },

    hideReports: function () {
        Traccar.app.showReports(false);
    },

    onConfigureClick: function () {
        var dialog = Ext.create('Traccar.view.ReportConfigDialog');
        dialog.lookupReference('eventTypeField').setHidden(this.lookupReference('reportTypeField').getValue() !== 'events');
        dialog.callingPanel = this;
        dialog.lookupReference('deviceField').setValue(this.deviceId);
        dialog.lookupReference('groupField').setValue(this.groupId);
        if (this.eventType !== undefined) {
            dialog.lookupReference('eventTypeField').setValue(this.eventType);
        } else {
            dialog.lookupReference('eventTypeField').setValue([Traccar.store.ReportEventTypes.allEvents]);
        }
        if (this.fromDate !== undefined) {
            dialog.lookupReference('fromDateField').setValue(this.fromDate);
        }
        if (this.fromTime !== undefined) {
            dialog.lookupReference('fromTimeField').setValue(this.fromTime);
        }
        if (this.toDate !== undefined) {
            dialog.lookupReference('toDateField').setValue(this.toDate);
        }
        if (this.toTime !== undefined) {
            dialog.lookupReference('toTimeField').setValue(this.toTime);
        }
        dialog.show();
    },

    updateButtons: function () {
        var reportType, disabled, devices, time;
        reportType = this.lookupReference('reportTypeField').getValue();
        devices = (this.deviceId && this.deviceId.length !== 0) || (this.groupId && this.groupId.length !== 0);
        time = this.fromDate && this.fromTime && this.toDate && this.toTime;
        disabled = !reportType || !devices || !time;
        this.lookupReference('showButton').setDisabled(disabled);
        this.lookupReference('exportButton').setDisabled(disabled);
    },

    onReportClick: function (button) {
        var reportType, from, to, store, url;

        reportType = this.lookupReference('reportTypeField').getValue();

        if (reportType && (this.deviceId || this.groupId)) {
            from = new Date(
                this.fromDate.getFullYear(), this.fromDate.getMonth(), this.fromDate.getDate(),
                this.fromTime.getHours(), this.fromTime.getMinutes(), this.fromTime.getSeconds(), this.fromTime.getMilliseconds());

            to = new Date(
                this.toDate.getFullYear(), this.toDate.getMonth(), this.toDate.getDate(),
                this.toTime.getHours(), this.toTime.getMinutes(), this.toTime.getSeconds(), this.toTime.getMilliseconds());

            if (button.reference === 'showButton') {
                store = this.getView().getStore();
                store.load({
                    params: {
                        deviceId: this.deviceId,
                        groupId: this.groupId,
                        type: this.eventType,
                        from: from.toISOString(),
                        to: to.toISOString()
                    }
                });
            } else if (button.reference === 'exportButton') {
                url = this.getView().getStore().getProxy().url;
                this.downloadFile(url, {
                    deviceId: this.deviceId,
                    groupId: this.groupId,
                    type: this.eventType,
                    from: from.toISOString(),
                    to: to.toISOString()
                });
            }
        }
    },

    onClearClick: function () {
        var reportType = this.lookupReference('reportTypeField').getValue();
        this.clearReport(reportType);
    },

    clearReport: function (reportType) {
        this.getView().getStore().removeAll();
        if (reportType === 'trips') {
            Ext.getStore('ReportRoute').removeAll();
        }
    },

    onSelectionChange: function (selected) {
        var report;
        if (selected.getCount() > 0) {
            report = selected.getLastSelected();
            this.fireEvent('selectreport', report, true);
            if (report instanceof Traccar.model.ReportTrip) {
                this.selectTrip(report);
            }
        }
    },

    selectDevice: function (device) {
        if (device) {
            this.getView().getSelectionModel().deselectAll();
        }
    },

    selectReport: function (object, center) {
        var reportType = this.lookupReference('reportTypeField').getValue();
        if (object instanceof Traccar.model.Position && reportType === 'route') {
            this.getView().getSelectionModel().select([object], false, true);
            this.getView().getView().focusRow(object);
        }
    },

    selectTrip: function (trip) {
        var from, to;
        from = new Date(trip.get('startTime'));
        to = new Date(trip.get('endTime'));
        Ext.getStore('ReportRoute').removeAll();
        Ext.getStore('ReportRoute').load({
            params: {
                deviceId: trip.get('deviceId'),
                from: from.toISOString(),
                to: to.toISOString()
            }
        });
    },

    downloadFile: function (requestUrl, requestParams) {
        Ext.Ajax.request({
            url: requestUrl,
            method: 'GET',
            params: requestParams,
            headers: {
                Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            },
            binary: true,
            success: function (response) {
                var disposition, filename, type, blob, url, downloadUrl;
                disposition = response.getResponseHeader('Content-Disposition');
                filename = disposition.slice(disposition.indexOf('=') + 1, disposition.length);
                type = response.getResponseHeader('Content-Type');
                blob = new Blob([response.responseBytes], {type: type});
                if (typeof window.navigator.msSaveBlob !== 'undefined') {
                    // IE workaround
                    window.navigator.msSaveBlob(blob, filename);
                } else {
                    url = window.URL || window.webkitURL;
                    downloadUrl = url.createObjectURL(blob);
                    if (filename) {
                        Ext.dom.Helper.append(Ext.getBody(), {
                            tag: 'a',
                            href: downloadUrl,
                            download: filename
                        }).click();
                    }
                    setTimeout(function () {
                        url.revokeObjectURL(downloadUrl);
                    }, 100);
                }
            }
        });
    },

    onTypeChange: function (combobox, newValue, oldValue) {
        if (oldValue !== null) {
            this.clearReport(oldValue);
        }

        if (newValue === 'route') {
            this.getView().reconfigure('ReportRoute', this.routeColumns);
        } else if (newValue === 'events') {
            this.getView().reconfigure('ReportEvents', this.eventsColumns);
        } else if (newValue === 'summary') {
            this.getView().reconfigure('ReportSummary', this.summaryColumns);
        } else if (newValue === 'trips') {
            this.getView().reconfigure('ReportTrips', this.tripsColumns);
        }

        this.updateButtons();
    },

    routeColumns: [{
        text: Strings.positionValid,
        dataIndex: 'valid',
        renderer: Traccar.AttributeFormatter.getFormatter('valid')
    }, {
        text: Strings.positionFixTime,
        dataIndex: 'fixTime',
        xtype: 'datecolumn',
        renderer: Traccar.AttributeFormatter.getFormatter('fixTime')
    }, {
        text: Strings.positionLatitude,
        dataIndex: 'latitude',
        renderer: Traccar.AttributeFormatter.getFormatter('latitude')
    }, {
        text: Strings.positionLongitude,
        dataIndex: 'longitude',
        renderer: Traccar.AttributeFormatter.getFormatter('latitude')
    }, {
        text: Strings.positionAltitude,
        dataIndex: 'altitude',
        renderer: Traccar.AttributeFormatter.getFormatter('altitude')
    }, {
        text: Strings.positionSpeed,
        dataIndex: 'speed',
        renderer: Traccar.AttributeFormatter.getFormatter('speed')
    }, {
        text: Strings.positionAddress,
        dataIndex: 'address',
        renderer: Traccar.AttributeFormatter.getFormatter('address')
    }],

    eventsColumns: [{
        text: Strings.positionFixTime,
        dataIndex: 'serverTime',
        xtype: 'datecolumn',
        renderer: Traccar.AttributeFormatter.getFormatter('serverTime')
    }, {
        text: Strings.reportDeviceName,
        dataIndex: 'deviceId',
        renderer: function (value) {
            return Ext.getStore('Devices').findRecord('id', value).get('name');
        }
    }, {
        text: Strings.sharedType,
        dataIndex: 'type',
        renderer: function (value) {
            var typeKey = 'event' + value.charAt(0).toUpperCase() + value.slice(1);
            return Strings[typeKey];
        }
    }, {
        text: Strings.sharedGeofence,
        dataIndex: 'geofenceId',
        renderer: function (value) {
            if (value !== 0) {
                return Ext.getStore('Geofences').findRecord('id', value).get('name');
            }
        }
    }],

    summaryColumns: [{
        text: Strings.reportDeviceName,
        dataIndex: 'deviceId',
        renderer: function (value) {
            return Ext.getStore('Devices').findRecord('id', value).get('name');
        }
    }, {
        text: Strings.sharedDistance,
        dataIndex: 'distance',
        renderer: Traccar.AttributeFormatter.getFormatter('distance')
    }, {
        text: Strings.reportAverageSpeed,
        dataIndex: 'averageSpeed',
        renderer: Traccar.AttributeFormatter.getFormatter('speed')
    }, {
        text: Strings.reportMaximumSpeed,
        dataIndex: 'maxSpeed',
        renderer: Traccar.AttributeFormatter.getFormatter('speed')
    }, {
        text: Strings.reportEngineHours,
        dataIndex: 'engineHours',
        renderer: Traccar.AttributeFormatter.getFormatter('hours')
    }],

    tripsColumns: [{
        text: Strings.reportDeviceName,
        dataIndex: 'deviceId',
        renderer: function (value) {
            return Ext.getStore('Devices').findRecord('id', value).get('name');
        }
    }, {
        text: Strings.reportStartTime,
        dataIndex: 'startTime',
        xtype: 'datecolumn',
        renderer: Traccar.AttributeFormatter.getFormatter('startTime')
    }, {
        text: Strings.reportStartAddress,
        dataIndex: 'startAddress',
        renderer: Traccar.AttributeFormatter.getFormatter('address')
    }, {
        text: Strings.reportEndTime,
        dataIndex: 'endTime',
        xtype: 'datecolumn',
        renderer: Traccar.AttributeFormatter.getFormatter('endTime')
    }, {
        text: Strings.reportEndAddress,
        dataIndex: 'endAddress',
        renderer: Traccar.AttributeFormatter.getFormatter('address')
    }, {
        text: Strings.sharedDistance,
        dataIndex: 'distance',
        renderer: Traccar.AttributeFormatter.getFormatter('distance')
    }, {
        text: Strings.reportAverageSpeed,
        dataIndex: 'averageSpeed',
        renderer: Traccar.AttributeFormatter.getFormatter('speed')
    }, {
        text: Strings.reportMaximumSpeed,
        dataIndex: 'maxSpeed',
        renderer: Traccar.AttributeFormatter.getFormatter('speed')
    }, {
        text: Strings.reportDuration,
        dataIndex: 'duration',
        renderer: Traccar.AttributeFormatter.getFormatter('duration')
    }, {
        text: Strings.reportSpentFuel,
        dataIndex: 'spentFuel',
        renderer: Traccar.AttributeFormatter.getFormatter('spentFuel')
    }]
});
