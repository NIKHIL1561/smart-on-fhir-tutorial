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
		  var systolicbpNum="";
		  var diastolicbpNum="";
		  var result="";
		  var description="";
          var p = defaultPatient();
          p.birthdate = patient.birthDate;
          p.gender = gender;
          p.fname = fname;
          p.lname = lname;
          p.height = getQuantityValueAndUnit(height[0]);

          if (typeof systolicbp != 'undefined')  {
            p.systolicbp = systolicbp;
			var num = p.systolicbp.toString().replace ( /[^\d.]/g, '' );
			systolicbpNum = num - num%10;
          }

          if (typeof diastolicbp != 'undefined') {
            p.diastolicbp = diastolicbp;
			var num2 = p.diastolicbp.toString().replace ( /[^\d.]/g, '' );
			diastolicbpNum = (num2 - num2%10);
          }			  
		 
		  if(systolicbpNum>139 || diastolicbpNum>89)
		  {
			  result = "HIGH BLOOD PRESSURE";
			  description = "Your BP reading is high. Known as the silent killer, high blood pressure rarely has obvious symptoms. But left untreated, it increases your risk of having a heart attack or stroke";
		  }
		  else if(systolicbpNum>119 || diastolicbpNum>79)
		  {
			  result = "PRE-HIGH BLOOD PRESSURE";
			  description = "While your blood pressure is OK, it still might be described as being high-normal. Ideally, it should be below 120/80mmHg";
		  }
		  else if(systolicbpNum>89 || diastolicbpNum>59)
		  {
			  result = "IDEAL BLOOD PRESSURE";
			  description = "Your blood pressure is in the ideal range. Keep up the healthy lifestyle";
		  }
		   else if(systolicbpNum>69 || diastolicbpNum>39)
		  {
			  result = "LOW BLOOD PRESSURE";
			  description = "Naturally low blood pressure is unlikely to cause any symptoms and is normally nothing to worry about"
							+"\n\nHowever, if you have any of the following symptoms, please see your doctor:"
							+"\n-chest pain"
							+"\n-sweating"
							+"\n-shortness of breath"
							+"\n-unsteadiness"
							+"\n-dizziness"
							+"\n-lightheadedness";
		  }
		  else
		  {
			  result = "Data not available";
			  description = "-";
		  }
          p.hdl = getQuantityValueAndUnit(hdl[0]);
          p.ldl = getQuantityValueAndUnit(ldl[0]);
		  p.medname = medicationlist;
		  //p.dosage = dosage;
		  p.x=x.bold();
		  p.cellId=systolicbpNum.toString()+""+diastolicbpNum.toString();
		  p.result = result;
		  p.description = description;
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
	  result: {value: ''},
	  description: {value: ''},
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
	$('result').html(p.result);
	$('description').html(p.description);
  };

})(window);
