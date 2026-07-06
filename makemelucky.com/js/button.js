var clampsStatus = 'closed';

function clamps(){
	$("#clamps").removeClass();
	$("#clamps").addClass('clampsOpening');
	setTimeout(function(){
		$("#clamps").removeClass('clampsOpening');
		if(clampsStatus == 'closed') {
			$("#clamps").addClass('clampsOpen');
			clampsStatus = 'open';
		} else {
			$("#clamps").addClass('clampsClosed');
			clampsStatus = 'closed';
		}
	}, 50);
}



function spinningRim(){
	clamps();
	$('.effects').show();
	setTimeout(function(){
		$('#rimSpinning').velocity({ 
			rotateZ: "7200deg" 
		}, {
			display: 'block', 
			duration:5000, 
			complete: function() {
				$('#rimSpinning').velocity({ 
					rotateZ: "0deg" 
				}, {
					display: 'none', 
					duration:0
				});
				setTimeout(function(){
					clamps();
				},500);
				setTimeout(function(){
					$('#midOverlay, #glowClosed').velocity({ opacity: 1 }, { display: "block", duration: 200 });
					$('#midOverlay, #glowClosed').velocity({ opacity: 0 }, { display: "none",  delay: 300, duration: 1000, complete: function(){
						$('.effects').hide();
						setTimeout(animationComplete, 500);
					}});
				},600);		

			}
		});
		$('.cog').velocity({ 
			rotateZ: "-14400deg" 
		}, {
			duration:5000, 
			complete: function() {
				$('.cog').velocity({ 
					rotateZ: "0deg" 
				}, {
					duration:0
				});
			}
		});
		setTimeout(function(){
			$('#topOverlay, #spark1').velocity({ opacity: 1 }, { display: "block", duration: 50 });
			$('#topOverlay, #spark1').velocity({ opacity: 0 }, { display: "none", duration: 500 });
		},1000);
		setTimeout(function(){
			$('#topOverlay, #spark2').velocity({ opacity: 1 }, { display: "block", duration: 50 });
			$('#topOverlay, #spark2').velocity({ opacity: 0 }, { display: "none", duration: 500 });
		},2000);
		setTimeout(function(){
			$('#topOverlay, #spark3').velocity({ opacity: 1 }, { display: "block", duration: 50 });
			$('#topOverlay, #spark3').velocity({ opacity: 0 }, { display: "none", duration: 500 });
		},3000);
		setTimeout(function(){
			$('#topOverlay, #spark4').velocity({ opacity: 1 }, { display: "block", duration: 50 });
			$('#topOverlay, #spark4').velocity({ opacity: 0 }, { display: "none", duration: 500 });
		},4000);
	},100);
}

function luckySymbol(){
	$('.effects').show();
	$('#glowClosed').velocity({ opacity: 1 }, { display: "block", duration: 100 });
	$('#glowClosed').velocity({ opacity: 0 }, { display: "none", duration: 500});
	$('#topOverlay').velocity({ opacity: 1 }, { display: "block", duration: 500 });
	$('#topOverlay').velocity({ opacity: 0 }, { display: "none", duration: 500, delay: 500 });
	$('#luckySymbol').velocity({ opacity: 1, translateZ: [0, -5000]}, { display: "block", duration: 1000, easing: "ease-out", begin: function(){
		particles.shootingStars(200);
	}});
	$('#luckySymbol').velocity({ opacity: 0, translateZ: 2000}, { display: "none", duration: 500, easing: "ease-in", complete: function(){
		$('.effects').hide();
		setTimeout(animationComplete, 500);
	}});
	
}

function openRim(){
	clamps();
	setTimeout(function(){
		$('#rimOpen').show();
		$('#rim').hide();
		$('#rimTop').velocity({ top: '-18%'}, { duration: 2000 });
		$('#rimRight').velocity({ right: '-18%'}, { duration: 2000 });
		$('#rimBottom').velocity({ bottom: '-18%'}, { duration: 2000 });
		$('#rimLeft').velocity({ left: '-18%'}, { duration: 2000 });
		$('.cog').velocity({ rotateZ: "360deg" }, { duration:2000 });
	},100);
}

function closeRim(){
	$('#rimTop').velocity({ top: '0%'}, { duration: 2000 });
	$('#rimRight').velocity({ right: '0%'}, { duration: 2000 });
	$('#rimBottom').velocity({ bottom: '0%'}, { duration: 2000 });
	$('#rimLeft').velocity({ left: '0%'}, { duration: 2000 });
	$('.cog').velocity({ rotateZ: "0deg" }, { duration:2000, 
		complete:function(){
			clamps();
			$('#rim').show();
			$('#rimOpen').hide();
		}
	});
}

function rimLight(){
	$('.effects').show();
	$('#rimLight').velocity({ opacity: 1, rotateZ: '180deg' }, { display: "block", duration: 500, easing: 'linear' });
	$('#rimLight').velocity({ rotateZ: '900deg' }, { duration: 2000, easing: 'linear',
		begin: function(){
			outerLightSpin(45, 3);
		},
		complete: function(){
			$('#midOverlay, #glowClosed, .outerLight').velocity({ opacity: 1 }, { display: "block", delay: 250, duration: 300 });
			$('#midOverlay, #glowClosed, .outerLight').velocity({ opacity: 0 }, { display: "none",  duration: 600, complete: function(){
				$('.effects').hide();
				setTimeout(animationComplete, 500);
			}});
		}
	 });
	$('#rimLight').velocity({ opacity: 0, rotateZ: '1080deg' }, { display: "none", duration: 500, easing: 'linear' });
	$('#rimLight').velocity({ rotateZ: '0deg' }, { duration: 1 });
}


function buttonFall(){
	openRim();
	$('.effects').show();
	$('#button').velocity({ scaleX: 0.001, scaleY: 0.001}, { duration: 3500, easing: 'easeInQuart', complete: function(){
		$('#cloudLight').velocity({ opacity: 1 }, { display: "block", duration: 50});
		$('#cloudLight').velocity({ opacity: 0 }, { display: "none", delay:500, duration: 450});
	}});
	$('#clouds').velocity({ opacity: 1 }, { display: "block", duration: 1500 });
	$('#button').velocity({ scaleX: 1, scaleY: 1}, { duration: 1500, easing: 'easeOutElastic', delay: 1000,
	    begin: function(){
			setTimeout(particles.explosion, 200);
	    }, 
		complete: function(){ 
			closeRim(); 
			$('#clouds').velocity({ opacity: 0 }, { display: "none", duration: 2500,
				complete: function(){
					$('.effects').hide();
					setTimeout(animationComplete, 500);					
				}});
		}});
}

function cloudsTunnelOpen(){
	openRim();
	$('#button').velocity({ scaleX: 0.3, scaleY: 0.3, }, { duration: 5000, delay: 1000, easing: 'easeInQuart', complete: function(){
		particles.shootingStars(500);
	} });
	$('#cloudsTunnel').velocity({ opacity: 1, rotateZ: 90 }, { display: "block", duration: 4000 , easing: 'linear'});
	$('#cloudsTunnel').velocity({ rotateZ: 180 }, { display: "block", duration: 4000, easing: 'linear' });
	$('#cloudsTunnel').velocity({ opacity: 0, rotateZ: 270 }, { display: "none", duration: 4000, easing: 'linear' });
	$('#cloudsTunnel').velocity({ rotateZ: 0 }, { display: "none", duration: 10 });
	$('#button').velocity({ scaleX: 1, scaleY: 1, rotateX: '0deg' }, { duration: 1000, delay: 1000, easing: 'easeInQuart',complete: function(){ 
		$('.effects').show();
		$('#midOverlay, #glowOpen').velocity({ opacity: 1 }, { display: "block",duration: 300 });
		$('#midOverlay, #glowOpen').velocity({ opacity: 0 }, { display: "none", delay: 500, duration: 600, complete: function(){
			$('.effects').hide();
			closeRim();
			setTimeout(animationComplete, 2000);
		}});
		 
	}});
}

function powerStreams(){
	$('#whiteOverlay').velocity({ opacity: 1}, { display: "block", duration: 100 });
	$('#whiteOverlay').velocity({ opacity: 0}, { display: "none", duration: 100 });
	$('.effects, #effectsButton, #powerStream1, #powerStream2, #powerStream3, #powerStream4').show();
	$('#rimGlow, #midOverlay, #magicSwirl1, #magicSwirl2').velocity({ opacity: 1}, { display: "block", duration: 200 });
	setTimeout(function(){
		openRim();
		$('#powerStream1, #powerStream2, #powerStream3, #powerStream4').velocity({ opacity: 0}, { display: "none", duration: 300 });
		$('#rimGlow, #midOverlay, #magicSwirl1, #magicSwirl2').velocity({ opacity: 0}, { display: "none", delay: 1000, duration: 2000, complete: function(){
			$('.effects, #effectsButton').hide();
			setTimeout(closeRim, 3000);
			setTimeout(animationComplete, 5000);
		} });
	},3000);
}

var luckyEffects =['powerStreams', 'spinningRim', 'buttonFall', 'cloudsTunnelOpen', 'luckySymbol', 'rimLight'],
	luckyPresses = 0;

var olCount = 1,
	olLoops = 1;

function outerLightSpin(delay, loops){
	olLoops = loops;
	$('#ol' + olCount).velocity({ opacity: 1 }, { display: "block", duration: 100 });
	$('#ol' + olCount).velocity({ opacity: 0 }, { display: "none", duration: 500});
	olCount++;
	if(olCount == 13 && olLoops == 1){
		olCount = 1;
	} else if(olCount == 13){
		olCount = 1;
		olLoops--;
		setTimeout(function(){
			outerLightSpin(delay, olLoops);
		}, delay)
	} else {
		setTimeout(function(){
			outerLightSpin(delay, olLoops);
		}, delay)
	}
}


function animationComplete(){
	buttonReady = true;
	buttonReleased = false;
	screenText.textQueue(['You are now','LUCKY!','Press again','for more luck'])
}

// $('#button').click(function(){
// 	window[luckyEffects[(luckyPresses % luckyEffects.length)]]();
// 	luckyPresses++;
// 	mml.luckybness++;
// 	storeTheLuck();
// });

//Particles
var particles = {
	randomPos: function(distance){
		return ((Math.random() - 0.5) * 2) * distance;
	},
	randomUp: function(distance){
		return 0 - (Math.random() * distance);
	},
	randomTime: function(baseTime){
		return Math.round(Math.random() * baseTime);
	},
	RandomDistance: function(distance){
		return Math.round(Math.random() * (distance * 0.75)) + Math.round((distance * 2.5));
	},
	explosion: function(){
		var particleDistance = ((($(window).width() - $('#luckyButtonContainer').width()) / 2) + (($(window).height() - $('#luckyButtonContainer').height()) / 2)) / 2;
		//console.log(particleDistance);
		for (var i = 1; i < 65; i++) {		
			$('#p' + i).velocity({translateX:particles.randomPos(particleDistance), translateY: particles.randomPos(particleDistance), translateZ:particles.randomPos(150), scaleX: 0.5, scaleY: 0.5, opacity:1}, { duration: particles.randomTime(1000) + 500, easing: 'easeOutQuint', display:'block', delay: particles.randomTime(100) });
			$('#p' + i).velocity({translateX: '+=' + particles.randomPos(particleDistance / 2), translateY: '+=' + particles.randomUp(particleDistance / 2), translateZ: '+=' + particles.randomPos(100), scaleX: 0.2, scaleY: 0.2}, { duration: particles.randomTime(800), easing: 'easeInOutCirc' });
			$('#p' + i).velocity({translateX:'+=' + particles.randomPos(particleDistance / 4), translateY: '+=' + particles.randomUp(particleDistance / 4), translateZ: '+=' + particles.randomPos(50), scaleX: 0, scaleY: 0, opacity:0}, { duration: particles.randomTime(400), easing: 'easeInQuart' });
			$('#p' + i).velocity({translateX:0, translateY: 0, translateZ:0, scaleX: 1, scaleY: 1, opacity:0}, { duration: 0, display: 'none' });
		};
	},
	shootingStars: function(time){
		$('.effects').show();
		var delayTime = time / 48;
		var particleDistance = ((($(window).width() - $('#luckyButtonContainer').width()) / 2) + (($(window).height() - $('#luckyButtonContainer').height()) / 2)) / 12;
		for (var i = 1; i < 25; i++) {
			var angle = particles.randomPos(180);
			$('#ss' + i).velocity({rotateZ: [angle, angle], translateY: -particles.RandomDistance(particleDistance), scaleX: [1, 0.1], scaleY: [1, 0.1],  opacity: [1,0]}, {duration: 500, display:'block', delay: (i * delayTime) + particles.randomTime(delayTime), easing: 'easeInQuart'});
			$('#ss' + i).velocity({translateY: '+=' + -particles.RandomDistance(particleDistance), scaleX: 1.5, scaleY: 1.5, opacity:0}, {duration: 500, display:'none', easing: 'easeOutQuart'});
			$('#ss' + i).velocity({rotateZ: 0, translateY: 0, scaleX: 0.1, scaleY: 0.1, opacity:0}, {duration: 0, display:'none'});
		};
	},
	starSpiral: function(time){
		$('.effects').show();
		var delayTime = time / 24;
		var particleDistance = ((($(window).width() - $('#luckyButtonContainer').width()) / 2) + (($(window).height() - $('#luckyButtonContainer').height()) / 2)) / 4;
		for (var i = 1; i < 25; i++) {
			$('#ss' + i).velocity({rotateZ: [(i - 1) * 15, (i - 1) * 15], translateY: -particleDistance * 0.25, scaleX: [1, 0.1], scaleY: [1, 0.1],  opacity: [1,0]}, {duration: 500, display:'block', delay: (i * delayTime), easing: 'easeInQuart'});
			$('#ss' + i).velocity({translateY: '+=' + -particleDistance * 0.75, scaleX: 1.5, scaleY: 1.5, opacity:0}, {duration: 500, display:'none', easing: 'easeOutQuart'});
			$('#ss' + i).velocity({rotateZ: 0, translateY: 0, scaleX: 0.1, scaleY: 0.1, opacity:0}, {duration: 0, display:'none'});	
		}
	}
}