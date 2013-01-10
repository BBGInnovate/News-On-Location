(function() {

var tweetResults = app.getTweets(tweets[0] + ' OR ' + tweets[1], tweets[2]);
console.log('Tweet Results are:')
console.log(tweetResults);

		/* ************************************************************
		 * TWITTER INTEGRATION
		 *
		 * ************************************************************/
		twitter = {};
		tweets = [
			'facebook',             // First term
			'google',             // Second term
			'39,-98,1500mi'     // search location and radius (lat,lon,radius)
		];

		// Fetch tweets from Twitter
		getTweets = function(query, geo) {
		    tweets.params.q = query;
		    tweets.params.geocode = geo;    
		
		    params = '?' + _.map(tweets.params, function(num, key) {
			return key + "=" + num;
		    }).join('&');
			
		    reqwest({
			url: 'http://search.twitter.com/search.json' + params,
			type: 'jsonp',
			jsonCallback: 'callback',
			success: function(d) {
			    tweets.processTweet(d);
			    console.log(d);
			}
		    });
		}
		
		// Extract relevant data from tweets
		processTweet = function(d) {
		    _.each(d.results, function(element, index) {
			if (element.geo && element.geo.type === 'Point') {
			    var lat = element.geo.coordinates[0], // Twitter seems to reverse the
				lon = element.geo.coordinates[1]; // order of geojson coordinates
				
			} else if (element.location && element.location.indexOf(': ') > 0) {
			    var coords = element.location.split(': ')[1],
				$lat = coords.split(',')[0] || 0,
				$lon = coords.split(',')[1] || 0;
		
			    if (!isNaN(parseFloat($lat)) && !isNaN(parseFloat($lon))) {
				var lon = parseFloat($lon),
				    lat = parseFloat($lat);
			    }
			}
			
			if (lat && lon) {
			    tweetRace.tweets.push({
				lon: lon,
				lat: lat,
				time: formatDate(new Date(element.created_at)),
				text: element.text,
				user: '@' + element.from_user,
				category: (element.text.toLowerCase().indexOf(tweets[0].toLowerCase()) >= 0) ? 'first' : 'second'
			    });
			}
		    });
		}

}).call(this);	