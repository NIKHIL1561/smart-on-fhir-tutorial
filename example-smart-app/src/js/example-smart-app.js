(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

    function onReady(smart)  {
      if (smart.hasOwnProperty('patient')) {
        var patient = smart.patient;
        var pt = patient.read();
        var obv = smart.patient.api.fetchAll({
                    type: 'Observation',
                    query: {
                      code: {
                        $or: ['http://loinc.org|8302-2', 'http://loinc.org|8462-4',
                              'http://loinc.org|8480-6', 'http://loinc.org|2085-9',
                              'http://loinc.org|2089-1', 'http://loinc.org|55284-4']
                      }
                    }
                  });
				  
		var medicationlist;
		smart.patient.api.fetchAllWithReferences(
                { type: "MedicationOrder" },
                [ "MedicationOrder.medicationReference" ]
            ).then(function(results, refs) {
                if (results.length) {
                    results.forEach(function(prescription) {
                        if (prescription.medicationCodeableConcept) {
                           medicationlist = medicationlist.concat(getMedicationName(prescription.medicationCodeableConcept.coding), ", ");
                        } else if (prescription.medicationReference) {
                            var med = refs(prescription, prescription.medicationReference);
                            medicationlist = medicationlist.concat(getMedicationName(med && med.code.coding || []), ", ");
                       }
                    });
                }
                else {
                    medicationlist = "No medications found for the selected patient";
                }
            });
			
        $.when(pt, obv).fail(onError);

        $.when(pt, obv).done(function(patient, obv) {
          var byCodes = smart.byCodes(obv, 'code');
          var gender = patient.gender;

          var fname = '';
          var lname = '';

          if (typeof patient.name[0] !== 'undefined') {
            fname = patient.name[0].given.join(' ');
            lname = patient.name[0].family.join(' ');
          }

          var height = byCodes('8302-2');
          var systolicbp = getBloodPressureValue(byCodes('55284-4'),'8480-6');
          var diastolicbp = getBloodPressureValue(byCodes('55284-4'),'8462-4');
          var hdl = byCodes('2085-9');
          var ldl = byCodes('2089-1');
		  
		  var medname = "acetaminophen";
		  var dosage = "5.5mg";
		  var x="X";
		  var cellId="";
		  var cellId2="";
          var p = defaultPatient();
          p.birthdate = patient.birthDate;
          p.gender = gender;
          p.fname = fname;
          p.lname = lname;
          p.height = getQuantityValueAndUnit(height[0]);

          if (typeof systolicbp != 'undefined')  {
            p.systolicbp = systolicbp;
			var num = p.systolicbp.toString().replace ( /[^\d.]/g, '' );
			cellId = num - num%10;
          }

          if (typeof diastolicbp != 'undefined') {
            p.diastolicbp = diastolicbp;
			var num2 = p.diastolicbp.toString().replace ( /[^\d.]/g, '' );
			cellId2 = (num2 - num2%10);
          }			  

          p.hdl = getQuantityValueAndUnit(hdl[0]);
          p.ldl = getQuantityValueAndUnit(ldl[0]);
		  p.medname = medicationlist;// cellId.toString()+""+cellId2.toString();
		  //p.dosage = dosage;
		  p.x=x.bold();
		  p.cellId=cellId.toString()+""+cellId2.toString();
		  
          ret.resolve(p);
        });
      } else {
        onError();
      }
    }

    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

  };

  function defaultPatient(){
    return {
      fname: {value: ''},
      lname: {value: ''},
      gender: {value: ''},
      birthdate: {value: ''},
      height: {value: ''},
      systolicbp: {value: ''},
      diastolicbp: {value: ''},
      ldl: {value: ''},
      hdl: {value: ''},
	  medname: {value: ''},
	  dosage: {value: ''},
	  x: {value: ''},
	  cellId: {value: ''},
    };
  }

  function getBloodPressureValue(BPObservations, typeOfPressure) {
    var formattedBPObservations = [];
    BPObservations.forEach(function(observation){
      var BP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          return coding.code == typeOfPressure;
        });
      });
      if (BP) {
        observation.valueQuantity = BP.valueQuantity;
        formattedBPObservations.push(observation);
      }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function getQuantityValueAndUnit(ob) {
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
          return ob.valueQuantity.value + ' ' + ob.valueQuantity.unit;
    } else {
      return undefined;
    }
  }
  
  function getMedicationName(medCodings) {
            var coding = medCodings.find(function(c) {
                return c.system == "http://www.nlm.nih.gov/research/umls/rxnorm";
            });
            return coding && coding.display || "Unnamed Medication(TM)";
        }

  window.drawVisualization = function(p) {
    $('#holder').show();
    $('#loading').hide();
    $('#fname').html(p.fname);
    $('#lname').html(p.lname);
    $('#gender').html(p.gender);
    $('#birthdate').html(p.birthdate);
    $('#height').html(p.height);
    $('#systolicbp').html(p.systolicbp);
    $('#diastolicbp').html(p.diastolicbp);
    $('#ldl').html(p.ldl);
    $('#hdl').html(p.hdl);
	$('#medname').html(p.medname);
	$('#dosage').html(p.dosage);
	$('#'+p.cellId).html(p.x);
  };

})(window);
