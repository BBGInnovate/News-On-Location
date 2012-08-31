loadSettings:function(){
			jQuery('#enable-badges').val(localStorage.allowBadges);
		},
		
		saveSettings:function() {
			localStorage.allowBadges = jQuery('#enable-badges').val();
		}, 
		
		roundNumber:function(num, dec) {
			//given a number and the nubmer of decimal places (ie. 6)
			//return rounded number
			var result = Math.round(num*Math.pow(10,dec))/Math.pow(10,dec);
			return result;
		},
		getActiveArea:function(id){
			//get large "area" polygon (i.e. Washington DC) given the id of the area
			var areas = app.getGeoJSON(app.areasUrl);
			var foundArea;
			jQuery.each(areas, function(index, value) {
				//each record in geojson
				if (value && typeof value === 'object') {
					jQuery.each(value, function(index, value){
						if ( value.geometry.type == 'Polygon' 
							&& value.properties.id == id) {
							//get the coords of the found area
							foundArea = value;
							if(app.debug){
								console.log("Current area: ");
								console.log(foundArea);
							}
						}
					});
				}
			});	//end outer jquery.each
			return foundArea;
		},//getActiveArea