(function() {
	var app = {
    
		tileUrl:'http://api.tiles.mapbox.com/v3/ericpugh.map-njhhx6z3.jsonp',
		blueIconUrl:'http://onm.voanews.com/html5/demos/finalmap/images/blue-dot.png',
		userLocation: [-77.0365, 38.8942], //default to Washington Monument
		locationAware: false,
		mapType: "News",
		availableMaps: ['News','Concert','Inauguration'],
		mapIsLive: false, //switch to hold whether or not the map has already been initialized
		nearbyDistance: 125, //distance from center point
		nearbyUnitOfMeasure: "meters", //unit of measurement to use with nearbyDistance
		defaultMapZoom: 17,
		allFeatures: [], //array of all features
		withinFeature: [], //current feature the user is "within"
		visitedFeatures: [],
		debug: true,
		lastLocationDrawTime:-1,
		SLOW_DRAW_INTERVAL:1000,
		lastMapMoveTime:-1,
		MAP_RELOCATE_INTERVAL:3000,
		map:{},
		dumbPopupMode:false,
		markersPlaced:false,
		DEFAULT_INITIAL_LONGITUDE:38.88765,
		DEFAULT_INITIAL_LATITUDE:-77.01666,
		
		logIt:function(str) {
			if (app.debug) {
				console.log(str);
			}
		},
		getParamByName:function(name){
		  name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
		  var regexS = "[\\?&]" + name + "=([^&#]*)";
		  var regex = new RegExp(regexS);
		  var results = regex.exec(window.location.search);
		  if(results == null)
		    return "";
		  else
		    return decodeURIComponent(results[1].replace(/\+/g, " "));
		}, //getParamByName

		getGeoJSON:function(){
			//TODO retrieve from local storage... else get ajax
			var result = false;
			jQuery.ajax({
			    url: 'http://api.storageroomapp.com/accounts/50292cbb0f66027a9d0001e6/collections/50292e380f660208b60000cd/entries.json',
			    data: {
			      auth_token: 'akbvXCscmepqRYF2ukZH',
			      per_page: 50
			    },
			    dataType: 'json',
			    async: false,
			    success: function(data) {
			      app.logIt('Ajax request... ');
			      result = data;
			    },
			    error: function() {
			      app.logIt("unable to retreive remote data.");
			    }
			});
    
			return result;
			
		}, //getGeoJSON
		

		resizeContentArea:function() {
			 //TODO: (flatmap) resize doesnt seem to work anymore.  in CHROME if you start w/ big area, then go small its fine.  if you start small then go big you get emptiness
			var content, contentHeight, footer, header, viewportHeight;
			window.scroll(0, 0);
			header = jQuery("header#app-header");
			footer = jQuery("footer#nav");
			content = jQuery("article.main");
			viewportHeight = jQuery(window).height();
			//if the address bar in Safari can we add 60px to the content height?
			//if(document.height < viewportHeight){
				  //document.body.style.height = (window.outerHeight + 50) + 'px';
			//}
			contentHeight = viewportHeight - header.outerHeight() - footer.outerHeight();
			jQuery("article").first().height(contentHeight);
			return $("#map_canvas").height(contentHeight);
		}, //resizeContentArea
		
		initLocation:function(){
			if (navigator.geolocation) {
				navigator.geolocation.getCurrentPosition(
					function success(position){
						app.userLocation[0] = position.coords.longitude;
						app.userLocation[1] = position.coords.latitude;
						initPoint = new Point(position.coords.latitude, position.coords.longitude)
						app.saveUserLocation(initPoint);
						app.locationAware = true;
						app.logIt('initLocation: ' + app.userLocation[1] + ', ' + app.userLocation[0]);
					},
					function fail(error){
						app.locationAware = false;
					}
				);
			} else {
				alert("We were unable to retrieve your location so this app won't work!");
				app.locationAware = false;
			}
		}, //initLocation
		
		callMapLocate:function() {
			app.logIt("WE ARE STARTING THE WATCHING OF LOCATION");
			app.mapLocationIsActive=true;
			app.map.locate({
				watch: true,
				setView: false,
				maxZoom: 20,
				maximumAge: 5000,
				enableHighAccuracy:true,
				timeout:8000
				
			});
		},
		
		initMap:function(){
			function onMapLoad(e) {
				//record map state
				app.logIt('Map initialized');
				if(app.isValidMap(map)){
					app.mapIsLive = true;
				}
			}
			function onLocationFound(e) {
				var radius = e.accuracy / 2;
				//don't show on huge radius
				if (radius < 500) {
										
					if (!app.markersPlaced) {
						app.markersPlaced=true;
						app.placeMarkers(app.map);
						var currentLoc= new L.LatLng( e.latlng.lat, e.latlng.lng);
						app.map.setView(currentLoc,app.defaultMapZoom);
					}
					
					var slowMode=true;
					var nowtime= (new Date()).getTime();
					app.logIt("ONLOCATIONFOUND - time is "  + nowtime + " radius is " + radius);
					var timePassed=nowtime-app.lastLocationDrawTime;
					if (timePassed > app.SLOW_DRAW_INTERVAL) {
						app.logIt("DRAWING!");
						app.lastLocationDrawTime=nowtime;	
						//save currrent location
						if(e.latlng){
							app.userLocation[0] = e.latlng.lng;
							app.userLocation[1] = e.latlng.lat;
							point = new Point(e.latlng.lat, e.latlng.lng);
							app.saveUserLocation(point);
							app.logIt("userLocation updated: " + e.latlng.lng + " was set to " + app.userLocation[0] + " and " + e.latlng.lat + " was set to " + app.userLocation[1]);
						}
						userMarker.setLatLng(e.latlng);
						userCircle.setLatLng(e.latlng);  
						userCircle.setRadius(radius);
						
						//open feature dialog if user is at this feature
						app.youAreHere();

						//app.logIt("map zoom is " + app.getMapZoom(app.map) + ", radius: " + radius);
					}
				}
			} //onlocationfound
		
			function onLocationError(e) {
				app.logIt('Map error: ' + e.message);
				app.mapIsLive = false;
			} //onlocationError
						
			function everySecond() {
				//app.logIt("EVERYSECOND");
				var stopWatch=true;
				if (stopWatch && !app.mapLocationIsActive) {
					var nowtime= (new Date()).getTime();
					var timePassed=nowtime-app.lastMapMoveTime;
					if (timePassed > app.MAP_RELOCATE_INTERVAL) {
						//app.callMapLocate();
					}
				}
			}
			
			function onMapViewMove(e){
				//app.logIt("WE ARE STOPPING THE WATCHING OF LOCATION");
				app.lastMapMoveTime= (new Date()).getTime();
				app.mapLocationIsActive=false;
				//map.stopLocate();
			}
						
			centerLocation = new window.L.LatLng(app.userLocation[1], app.userLocation[0]);
			map = new window.L.Map('map_canvas', {center: centerLocation, minZoom: 0, touchZoom: true});
			app.map = map;
			
			app.resizeContentArea(); 
			
			//custom tiles
			wax.tilejson(app.tileUrl, function(tilejson) {
				map.addLayer(new wax.leaf.connector(tilejson));
			});
			
			//with change to leaflet 0.4 you have to pass options object instead of unnamed obj
			var UserIcon = window.L.Icon.extend({
				options:{		   
					iconUrl: app.blueIconUrl,
					shadowUrl: null,
					iconSize: new L.Point(50, 50),
					iconAnchor: new L.Point(25, 25),
					popupAnchor: new L.Point(0, -25)
				}
			});
			
			//set the inital user location marker
			var userIcon = new UserIcon();
			var initialLatLng;
			if(app.userLocation){
				var initalLng = app.userLocation[0];
				var initalLat = app.userLocation[1];
				initialLatLng = new window.L.LatLng(initalLng, initalLat);
			} else {
				initialLatLng = new window.L.LatLng(app.DEFAULT_INITIAL_LONGITUDE, app.DEFAULT_INITIAL_LATITUDE);
			}
			
			var userMarker = new window.L.Marker(initialLatLng, {icon: userIcon});
			var userCircle = new window.L.Circle(initialLatLng, 24);
			map.addLayer(userMarker);
			map.addLayer(userCircle);
			
			//watch user's location
			app.callMapLocate();
			
			//set bounds to DC
			var southWest = new L.LatLng(38.710, -77.535),
				northEast = new L.LatLng(39.058, -76.817),
				cityBounds = new L.LatLngBounds(southWest, northEast);
			map.setMaxBounds(cityBounds);
			
			
			map.on('locationerror', onLocationError);
			map.on('load', onMapLoad);
			map.on('locationfound', onLocationFound);
			map.on('move', onMapViewMove);
			
			mapInterval = setInterval(everySecond,1000)
		
		}, //initMap
		
		updateUserPosition:function(map){
			//get user's stored position and update the user icon
			app.logIt("Updating user position...");
			if(app.userLocation.length > 0){
				app.logIt("yes we have the user's location")
				point = new Point(app.userLocation[1], app.userLocation[0]);
				app.saveUserLocation(point);
				userLatLng = new window.L.LatLng(app.userLocation[0], app.userLocation[1]);

				map.userMarker.setLatLng(userLatLng);
				map.userCircle.setLatLng(userLatLng);  
				map.userCircle.setRadius(map.radius);
			}
		}, //updateUserLocaton
	
		getMapZoom:function(map){
			//return either the current map zoom level or the default
			var zoom = app.map.getZoom();
			return ( (zoom && zoom < 17) ? zoom : 17);
		}, //getMapZoom
		
		isValidMap:function(map){
			var size = map.getSize();
			app.logIt('Map size: ' + size);
			//when the map fails to initialize, seems the width/height are set to 256px
			return (typeof size === 'object' && size.x != 0 && size.y != 0 && (size.x != 256 && size.y != 256));
		}, //checkMap

		popDetailDialog:function(id, html, dialogClass){
			//open popup dialog with feature info
			if (app.dumbPopupMode) {
				alert("This is a popup!");
			} else {
				setTimeout(function() {
					contentElem = jQuery('.feature-dialog article.feature-content');
					contentElem.html(html);
					if(dialogClass === 'alert'){
						contentElem.toggleClass(dialogClass,true);
					} else {
						contentElem.toggleClass(dialogClass,false);
					}
					jQuery('.feature-dialog').show();
				}, 100);
			}
		}, //popDetailDialog
		
		formatPopUpHTML:function(data){
			//given a feature, return html formated for the popup dialog
			popDetailHTML = '<h1>' + data.title + '</h1>';
			popDetailHTML += '<div class="feature-html">' + data.html + '</div>'
			popDetailHTML += '<div class="feature-code">' + data.code + '</div>';
			
			return popDetailHTML;
		}, //formatPopUpHTML

		showFeatureAlert:function(data){
			//only display the alert if it hasn't been previously been viewed
			if(app.isNewFeature(data.id)){
				//store the feature as "viewed" so the user doesn't continue to get the same feature alert.
				//TODO: switch this to a timestamp and only show if hasn't been viewed in last 30 seconds
				//or something along those lines - so you can go in and come back
				app.saveViewedFeatures(data.id);
				var dialogClass = "alert";
				//delay alert a couple secs
				setTimeout(function(){
					popDetailHTML = app.formatPopUpHTML(data);
					app.popDetailDialog(data.id, popDetailHTML, dialogClass);
				}, 100);
			}
		}, //showFeatureAlert
				
		placeMarkers:function(map){
			/* CHANGEJOE - cohen building marker wasn't showing reliably until i changed its id to 99 */
			app.logIt("Placing markers...");
			map.invalidateSize();
			var mapMarkers = [];
			//reset the features arrays
			app.allFeatures = [];
			app.withinFeature = [];
			
			var listItems, isNearby, isWithin, locationMessage, messageClass, html;
			var featureCollection = app.getGeoJSON();
			if(featureCollection){
				var resources = featureCollection.array.resources;
				jQuery.each(resources, function(index, value){
					//each json obj in the collection arrray 
					if (value.location.lat !== null && value.location.lng !== null){
						//only output content items for this map type (i.e. "News")
						if(value.map == app.mapType){
							//create leaflet LatLng from the coordinates array (notice the params are reversed)
							var mapMarkerLocation = new L.LatLng(value.location.lat, value.location.lng);
							var mapMarkerOptions = {}; //optional
							var mapMarker = new L.Marker(mapMarkerLocation, mapMarkerOptions);
							//set title and id (which can be used to retrieve a marker)
							mapMarker._leaflet_id = index;
							mapMarker.title = value.title;
							//featureInfo is not part of Leaflet. We're attaching it 
							//to the marker obj as a new property so it can used in the click handler
							mapMarker.featureInfo = value;
							mapMarker.featureInfo.id = index;
							mapMarker.on('click', function(e) {
								data = app.getFeatureDetail(e.target.featureInfo);
								popDetailHTML = app.formatPopUpHTML(data);
								app.popDetailDialog(data.id, popDetailHTML, "");
							});
							
							
							//all features are add to the array of all items
							app.allFeatures.push(value);
							
							//build the array of markers to be added to the map
							app.logIt("Pushing marker " + mapMarker._leaflet_id + ": " + value.title);
							mapMarkers.push(mapMarker);
						}
					}
				});
				//execute "youAreHere" when map first initalized
				app.youAreHere();
			}
			//add markers to map as a feature group
			var group = new L.FeatureGroup(mapMarkers); 
			map.addLayer(group); 
		},//placeMarkers
		
		youAreHere:function(){
			//TRUE if currentUserLocation is "within" a feature
			var features = app.allFeatures;
			var found = false;
			jQuery.each(features, function(index, value){
				//build polygon X number of meters around the marker point
				var returnType = "obj";
				topRightPoint = app.getDueCoords(value.location.lat, value.location.lng, 45, app.nearbyDistance, app.nearbyUnitOfMeasure, returnType);
				bottomRightPoint = app.getDueCoords(value.location.lat, value.location.lng, 135, app.nearbyDistance, app.nearbyUnitOfMeasure, returnType);
				bottomLeftPoint = app.getDueCoords(value.location.lat, value.location.lng, 225, app.nearbyDistance, app.nearbyUnitOfMeasure, returnType);
				topLeftPoint = app.getDueCoords(value.location.lat, value.location.lng, 315, app.nearbyDistance, app.nearbyUnitOfMeasure, returnType);
				var nearbyPolyCoords = [[topRightPoint, bottomRightPoint, bottomLeftPoint, topLeftPoint]];
				//get seperate arrays of lat and lng coords for testing "within" condition
				latCoords = [topLeftPoint.lat, topRightPoint.lat, bottomRightPoint.lat, bottomLeftPoint.lat];
				lngCoords = [topLeftPoint.lng, topRightPoint.lng, bottomRightPoint.lng, bottomLeftPoint.lng];
				isWithin = maphelper.isPointInPoly(app.userLocation[1], app.userLocation[0], latCoords, lngCoords);
	
				//If the user is located at this location, display the popup content
				if(isWithin === true){
					if(app.isNewFeature(value.id)){
						app.logIt('You are here: ' + value.title);
						app.showFeatureAlert(value);
						app.withinFeature.push(value);
						found = true;
					}
				}
			});
			return found;
		}, //youAreHere
		
		getFeatureDetail:function(data){
			//build detail given an obj or else an html elem as string
			//TODO retrieve from local storage??      
			var detail = {};
			if (typeof data === 'object') {
				//get the detail info from obj
				detail.id = data.id;
				detail.title = data.title;
				detail.html = data.html;
				detail.code = data.code;
			}
			return detail;
		},//getFeatureDetail
	
		isNewFeature:function(id){
			//check if a secret feature (by "id") has already been viewed
			for (var i = 0; i < app.visitedFeatures.length; i++) {
				if(app.visitedFeatures[i] == id){
					app.logIt(id + ' is NOT a new secret feature.');
					return false;
				}
			}
			return true;
		}, //isNewFeature
	
		saveViewedFeatures:function(id){
			//add feature to the visited array if it doesn't exist already
			var alreadyVisted = false;
			for (var i = 0; i < app.visitedFeatures.length; i++) {
				if(app.visitedFeatures[i] == id) {
					alreadyVisted = true;
				}
			}
			if(!alreadyVisted){
				app.visitedFeatures.push(id);
				//save in localStorage for debugging
				localStorage.viewedFeatures = app.visitedFeatures.join();
			}
		}, //saveViewedFeatures
	
	
		getDueCoords:function(lat, lng, bearing, distance, unit, returnType) {
			//Return a point used to draw a bounding box around a given center point based a certain distance from the point
			//for example, to get a 1km box around the point (lat/lng) :
			//topLeftCorner = getDueCoords(lat, lng, 315, 1, "km");
			//topRightCorner = getDueCoords(lat, lng, 45, 1, "km");
			//bottomRightCorner = getDueCoords(lat, lng, 135, 1, "km");
			//bottomLeftCorner = getDueCoords(lat, lng, 225, 1, "km");
			//adopted From:
			//http://www.richardpeacock.com/blog/2011/11/draw-box-around-coordinate-google-maps-based-miles-or-kilometers
			//requires rad2deg() and deg2rad() funcs which I've pasted from php.js
			
			//TODO what's going on here?? "meters" are ALWAYS used
			if (distance == "M") {
				//distance is in miles.
				radius = 3963.1676;
			} else if(distance == "km") {
				// distance is in km.
				radius = 6378.1;
			} else {
				//distance in meters
				radius = 6378100
			}
			
			var new_latitude = maphelper.rad2deg(Math.asin(Math.sin(maphelper.deg2rad(lat)) * Math.cos(distance / radius) + Math.cos(maphelper.deg2rad(lat)) * Math.sin(distance / radius) * Math.cos(maphelper.deg2rad(bearing))));
			var new_longitude = maphelper.rad2deg(maphelper.deg2rad(lng) + Math.atan2(Math.sin(maphelper.deg2rad(bearing)) * Math.sin(distance / radius) * Math.cos(maphelper.deg2rad(lat)), Math.cos(distance / radius) - Math.sin(maphelper.deg2rad(lat)) * Math.sin(maphelper.deg2rad(new_latitude))));
			
			var pointToReturn=new Point(new_latitude,new_longitude);
			if(returnType == "array"){
				pointToReturn= [new_latitude, new_longitude];
			} 
			return pointToReturn;
		},//getDueCoords
	  
		saveUserLocation:function(point){
			//save Point obj to local storage
			localStorage.setItem('userLocation', JSON.stringify(point));
		}, //saveUserLocation
		
		
		nearbyFeaturesContains:function(id){
			//does a given feature object already exist in the nearbyFeatures array?
			for (var i = 0; i < app.nearbyFeatures.length; i++) {
				if(app.nearbyFeatures[i].properties.id == id){
					return true;
				}
			}
			return false;
		},//nearbyFeaturesContains
		
		/*
		updateNearbyCount: function(){
			//var numNearbyItems = jQuery("#nearby-list li").length;
			var numNearbyItems = app.nearbyFeatures.length;
			if(numNearbyItems > 0){
				jQuery('footer#nav ul li.list-tab span.ui-li-count').text(numNearbyItems);
				jQuery('footer#nav ul li.list-tab span.ui-li-count').show();
			} else {
				jQuery('footer#nav ul li.list-tab span.ui-li-count').hide();
			}
		}, //updateNearbyCount
		*/
		
		
	}; //app
	window.app = app;

	function Point(lat,lng) {
		this.lat=lat;
		this.lng=lng;
	}

	// BEGIN CONTOUR CLASS DEFINITION
	function Contour(points) {
		this.pts = points || []; // an array of Point objects defining the contour
	}

	Contour.prototype = {
		area:function() {
			var area=0;
			var pts = this.pts;
			var nPts = pts.length;
			var j=nPts-1;
			var p1;
			var p2;
			
			for (var i=0;i<nPts;j=i++) {
				p1=pts[i]; p2=pts[j];
				area+=p1.lat*p2.lng;
				area-=p1.lng*p2.lat;
			}
			area/=2;
			return area;
		},
			
		centroid:function() {
			var pts = this.pts;
			var nPts = pts.length;
			var lat=0;
			var lng=0;
			var f;
			var j=nPts-1;
			var p1; var p2;
			
			for (var i=0;i<nPts;j=i++) {
				p1=pts[i];
				p2=pts[j];
				f = (p1.lat * p2.lng) - (p2.lat * p1.lng);
				lat += (p1.lat + p2.lat) * f;
				lng += (p1.lng + p2.lng) * f;
			}
			f=this.area()*6;
			return new Point(lat/f,lng/f);
		}
	} //END CONTOUR CLASS DEFINITION
	
	jQuery(document).ready(function(){
		//set the mapType from the querystring
		mapParam = app.getParamByName('map');
		if(app.availableMaps.indexOf(mapParam) != -1){
			//set map type
			app.mapType = mapParam;
			//display the current map in select dropdown
			$("#map-select").val(mapParam);
		}
		
		jQuery(".refresh-btn").live('click',function(e) {
			app.updateUserPosition(window.app.map);
		}); //end refresh-btn
		
		jQuery(".feature-dialog .close-btn").live('click',function(e) {
			//TODO: stop the soundcloud and youtube players from playing!
			jQuery(".loading").show();
			jQuery(".feature-dialog").hide();
			jQuery('.feature-dialog article.feature-content').html('');
			jQuery(".loading").hide();
		});//end close btn
		
		//handle the map select box
		jQuery('#map-select').change(function() {
			
			app.mapType = jQuery(this).val();
			app.logIt("Map type changed.")
			var params = [
				"map=" + jQuery(this).val()
			];
			window.location.href = "http://" + window.location.host + window.location.pathname + '?' + params.join('&');
		});

	});
	
}).call(this);	//ends anonymous function from top of file