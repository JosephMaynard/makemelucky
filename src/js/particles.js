//Particles
var particles = {
	generated: {},
	innit: function(name, className, container, amonut){
		if(typeof this.generated[name] == 'undefined'){
			this.generated[name] = [];
			for (var i = 0; i < amonut; i++) {
				this.generated[name][i] = document.createElement('div');
				this.generated[name][i].className = className;
				document.getElementById(container).appendChild(this.generated[name][i]);
			};
		} else {
			console.error('There is already a particle array with this name.');
		}
	},
	randomPos: function(distance){
		return Math.round(((Math.random() - 0.5) * 2) * distance);
	},
	randomUp: function(distance){
		return 0 - Math.round(Math.random() * distance);
	},
	randomTime: function(baseTime){
		return Math.round(Math.random() * baseTime);
	},
	RandomDistance: function(distance){
		return Math.round(Math.random() * (distance * 0.75)) + Math.round((distance * 2.5));
	},
	explosion: function(){
		var particleDistance = ((($(window).width() - $('#luckyButtonContainer').width()) / 2) + (($(window).height() - $('#luckyButtonContainer').height()) / 2)) / 2;
		for (var i = 0; i < particles.generated.particles.length; i++) {		
			$(particles.generated.particles[i]).velocity({translateX:particles.randomPos(particleDistance), translateY: particles.randomPos(particleDistance), translateZ:particles.randomPos(150), scaleX: 0.5, scaleY: 0.5, opacity:1}, { duration: particles.randomTime(1000) + 500, easing: 'easeOutQuint', display:'block', delay: particles.randomTime(100) });
			$(particles.generated.particles[i]).velocity({translateX: '+=' + particles.randomPos(particleDistance / 2), translateY: '+=' + particles.randomUp(particleDistance / 2), translateZ: '+=' + particles.randomPos(100), scaleX: 0.2, scaleY: 0.2}, { duration: particles.randomTime(800), easing: 'easeInOutCirc' });
			$(particles.generated.particles[i]).velocity({translateX:'+=' + particles.randomPos(particleDistance / 4), translateY: '+=' + particles.randomUp(particleDistance / 4), translateZ: '+=' + particles.randomPos(50), scaleX: 0, scaleY: 0, opacity:0}, { duration: particles.randomTime(400), easing: 'easeInQuart' });
			$(particles.generated.particles[i]).velocity({translateX:0, translateY: 0, translateZ:0, scaleX: 1, scaleY: 1, opacity:0}, { duration: 0, display: 'none' });
		};
	},
	shootingStars: function(time){
		$('.effects').show();
		var delayTime = time / particles.generated.shootingStars.length * 2;
		var particleDistance = ((($(window).width() - $('#luckyButtonContainer').width()) / 2) + (($(window).height() - $('#luckyButtonContainer').height()) / 2)) / 4;
		for (var i = 0; i < particles.generated.shootingStars.length; i++) {
			var angle = particles.randomPos(180);
			//$(particles.generated.shootingStars[i]).velocity({rotateZ: [angle, angle], translateY: -particles.RandomDistance(particleDistance), scaleX: [1, 0.1], scaleY: [1, 0.1],  opacity: [1,0]}, {duration: 500, display:'block', delay: (i * delayTime) + particles.randomTime(delayTime), easing: 'easeInQuart'});
			$(particles.generated.shootingStars[i]).velocity({
					rotateZ: [angle + 90, angle + 90],
					translateX: Math.round(Math.cos(angle * Math.PI / 180) * particleDistance),
					translateY: Math.round(Math.sin(angle * Math.PI / 180) * particleDistance),
					scaleX: [1, 0.1],
					scaleY: [1, 0.1],
					opacity: [1,0]
				}, {
					duration: 500,
					display:'block',
					delay: (i * delayTime) + particles.randomTime(delayTime),
					easing: 'easeInQuart'
				});
			$(particles.generated.shootingStars[i]).velocity({
					translateX: '+=' + Math.round(Math.cos(angle * Math.PI / 180) * particleDistance),
					translateY: '+=' + Math.round(Math.sin(angle * Math.PI / 180) * particleDistance),
					scaleX: 1.5,
					scaleY: 1.5,
					opacity: 0
				}, {
					duration: 500,
					display:'none',
					easing: 'easeOutQuart'
				});
			//$(particles.generated.shootingStars[i]).velocity({translateY: '+=' + -particles.RandomDistance(particleDistance), scaleX: 1.5, scaleY: 1.5, opacity:0}, {duration: 500, display:'none', easing: 'easeOutQuart'});
			$(particles.generated.shootingStars[i]).velocity({rotateZ: 0, translateX: 0, translateY: 0, scaleX: 0.1, scaleY: 0.1, opacity:0}, {duration: 0, display:'none'});
		};
	},
	starSpiral: function(time){
		$('.effects').show();
		var delayTime = time / particles.generated.shootingStars.length,
			angleIncrement = Math.ceil(360 / particles.generated.shootingStars.length);

		var particleDistance = ((($(window).width() - $('#luckyButtonContainer').width()) / 2) + (($(window).height() - $('#luckyButtonContainer').height()) / 2)) / 4;
		for (var i = 0; i < particles.generated.shootingStars.length; i++) {
			$(particles.generated.shootingStars[i]).velocity({rotateZ: [i * angleIncrement, i * angleIncrement], translateY: -particleDistance * 0.25, scaleX: [1, 0.1], scaleY: [1, 0.1],  opacity: [1,0]}, {duration: 500, display:'block', delay: (i * delayTime), easing: 'easeInQuart'});
			$(particles.generated.shootingStars[i]).velocity({translateY: '+=' + -particleDistance * 0.75, scaleX: 1.5, scaleY: 1.5, opacity:0}, {duration: 500, display:'none', easing: 'easeOutQuart'});
			$(particles.generated.shootingStars[i]).velocity({rotateZ: 0, translateY: 0, scaleX: 0.1, scaleY: 0.1, opacity:0}, {duration: 0, display:'none'});	
		}
	},
	awardStars: function(){
		var particleDistance = $('#screenInner').width() * 2;
		for (var i = 0; i < particles.generated.awardCharmStars.length; i++) {
			$(particles.generated.awardCharmStars[i]).velocity({translateX: [particles.randomPos(particleDistance), 0], translateY: [particles.randomPos(particleDistance / 3), 0], scaleX: [0.4, 0.04], scaleY: [0.4, 0.04],  opacity: [0,1]}, {duration: 1000, display:'block', easing: 'easeOutQuart'});
			$(particles.generated.awardCharmStars[i]).velocity({translateX:0, translateY:0, scaleX: 0.1, scaleY: 0.1,  opacity: 1}, {duration: 0, display:'none'});

		}
	}
}
//name, className, container, amount
particles.innit('particles', 'particle', 'particles', 24);
particles.innit('shootingStars', 'shootingStar', 'shootingStars', 24);
particles.innit('awardCharmStars', 'particle', 'screenInner', 24);