var clampsStatus = 'closed';

var sound = new Howl({
  urls: ['soundfx/makemelucky.mp3'],
  sprite: {
    cloudsTunnel: [1000, 12013],
    spinningRim: [14030, 9670],
    luckySymbol: [24000, 4400],
    rimLight: [29000, 5800],
    powerStreams: [35000, 8500],
    buttonFall: [44000, 9620],
    button: [54000, 2500],
    charmAward: [57000, 3520],
    lucky: [61000, 4000],
  }
});

function vibrate(value){
	if(window.navigator.vibrate && luckyVariables.luckStore.vibrationOn){
		navigator.vibrate(value);
	}
}

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
	if(luckyVariables.luckStore.soundOn) sound.play('spinningRim');
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
					vibrate(200);
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
			$('#topOverlay, #spark1').velocity({ opacity: 1 }, { display: "block", duration: 50, complete: function(){
				vibrate(50);
			} });
			$('#topOverlay, #spark1').velocity({ opacity: 0 }, { display: "none", duration: 500 });
		},1000);
		setTimeout(function(){
			$('#topOverlay, #spark2').velocity({ opacity: 1 }, { display: "block", duration: 50, complete: function(){
				vibrate(50);
			} });
			$('#topOverlay, #spark2').velocity({ opacity: 0 }, { display: "none", duration: 500 });
		},2000);
		setTimeout(function(){
			$('#topOverlay, #spark3').velocity({ opacity: 1 }, { display: "block", duration: 50, complete: function(){
				vibrate(50);
			} });
			$('#topOverlay, #spark3').velocity({ opacity: 0 }, { display: "none", duration: 500 });
		},3000);
		setTimeout(function(){
			$('#topOverlay, #spark4').velocity({ opacity: 1 }, { display: "block", duration: 50, complete: function(){
				vibrate(50);
			} });
			$('#topOverlay, #spark4').velocity({ opacity: 0 }, { display: "none", duration: 500 });
		},4000);
	},100);
}

function luckySymbol(){
	if(luckyVariables.luckStore.soundOn) sound.play('luckySymbol');
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
	if(luckyVariables.luckStore.soundOn) sound.play('rimLight');
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
	if(luckyVariables.luckStore.soundOn) sound.play('buttonFall');
	openRim();
	$('.effects').show();
	$('#button').velocity({ scaleX: 0.001, scaleY: 0.001}, { duration: 3500, easing: 'easeInQuart', complete: function(){
		$('#cloudLight').velocity({ opacity: 1 }, { display: "block", duration: 50});
		$('#cloudLight').velocity({ opacity: 0 }, { display: "none", delay:500, duration: 450});
	}});
	$('#clouds').velocity({ opacity: 1 }, { display: "block", duration: 1500 });
	$('#button').velocity({ scaleX: 1, scaleY: 1}, { duration: 1500, easing: [400,10], delay: 1000,
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
	if(luckyVariables.luckStore.soundOn) sound.play('cloudsTunnel');
	openRim();
	$('#button').velocity({ scaleX: 0.3, scaleY: 0.3, }, { duration: 4000, delay: 1000, easing: 'easeInQuart',
		begin: function(){
			$('#magicSwirl3, #magicSwirl4').velocity({ opacity: [1,0], scaleX: [1,0.5], scaleY: [1,0.5]}, { display: "block", delay: 1000, duration: 700 });
		},
		complete: function(){
			$('#magicSwirl3, #magicSwirl4').velocity({ opacity: 0, scaleX: 0.5, scaleY: 0.5}, { display: "none", delay: 500, duration: 1000 });
			particles.shootingStars(500);
		}
	});
	$('#cloudsTunnel').velocity({ opacity: 1, rotateZ: 90 }, { display: "block", duration: 4000 , easing: 'linear'});
	$('#cloudsTunnel').velocity({ rotateZ: 180 }, { display: "block", duration: 4000, easing: 'linear' });
	$('#cloudsTunnel').velocity({ opacity: 0, rotateZ: 270 }, { display: "none", duration: 4000, easing: 'linear' });
	$('#cloudsTunnel').velocity({ rotateZ: 0 }, { display: "none", duration: 10 });
	$('#button').velocity({ scaleX: 1, scaleY: 1, rotateX: '0deg' }, { duration: 1000, delay: 1000, easing: 'easeInQuart',complete: function(){ 
		$('.effects').show();
		$('#midOverlay, #glowOpen').velocity({ opacity: 1 }, { display: "block",duration: 300,begin: function(){
			setTimeout(function(){vibrate(200);},200);
		} });
		$('#midOverlay, #glowOpen').velocity({ opacity: 0 }, { display: "none", delay: 500, duration: 600, complete: function(){
			$('.effects').hide();
			closeRim();
			setTimeout(animationComplete, 2000);
		}});
		 
	}});
}

function powerStreams(){
	if(luckyVariables.luckStore.soundOn) sound.play('powerStreams');
	$('#whiteOverlay').velocity({ opacity: 1}, { display: "block", duration: 100 });
	$('#whiteOverlay').velocity({ opacity: 0}, { display: "none", duration: 100 });
	$('.effects, #effectsButton, #powerStream1, #powerStream2, #powerStream3, #powerStream4').velocity({ opacity: 1}, { display: "block", duration: 100 });
	$('#rimGlow, #midOverlay, #magicSwirl1, #magicSwirl2').velocity({ opacity: 1}, { display: "block", duration: 200 });
	setTimeout(function(){
		openRim();
		$('#powerStream1, #powerStream2, #powerStream3, #powerStream4').velocity({ opacity: 0}, { display: "none", duration: 300 });

		$('#powerRing1').velocity({scaleX:[3, 0.5], scaleY:[3, 0.5], opacity:[1,0], rotateZ:[particles.randomPos(50),particles.randomPos(50)]},{display:'block', duration: 600, easing:'easeInSine', delay: 1600, begin: function(){
			$('#glowOpen').velocity({opacity:1},{display: 'block', duration: 200, easing: 'easeOutCubic', complete: function(){
				vibrate(50);
			}});
			$('#glowOpen').velocity({opacity:0},{display: 'none', duration: 200, easing: 'easeOutCubic'});
		}});
		$('#powerRing1').velocity({scaleX: 8, scaleY:8, opacity: 0},{display:'none', duration: 300, easing:'easeOutSine'});
		
		$('#powerRing2').velocity({scaleX:[3, 0.5], scaleY:[3, 0.5], opacity:[1,0], rotateZ:[particles.randomPos(50),particles.randomPos(50)]},{display:'block', duration: 600, easing:'easeInSine', delay: 2000, begin: function(){
			$('#glowOpen').velocity({opacity:1},{display: 'block', duration: 200, easing: 'easeOutCubic', complete: function(){
				vibrate(50);
			}});
			$('#glowOpen').velocity({opacity:0},{display: 'none', duration: 200, easing: 'easeOutCubic'});
		}});
		$('#powerRing2').velocity({scaleX: 8, scaleY:8, opacity: 0},{display:'none', duration: 300, easing:'easeOutSine'});

		$('#powerRing3').velocity({scaleX:[3, 0.5], scaleY:[3, 0.5], opacity:[1,0], rotateZ:[particles.randomPos(50),particles.randomPos(50)]},{display:'block', duration: 600, easing:'easeInSine', delay: 2400, begin: function(){
			$('#glowOpen').velocity({opacity:1},{display: 'block', duration: 200, easing: 'easeOutCubic', complete: function(){
				vibrate(50);
			}});
			$('#glowOpen').velocity({opacity:0},{display: 'none', duration: 200, easing: 'easeOutCubic'});
		}});
		$('#powerRing3').velocity({scaleX: 8, scaleY:8, opacity: 0},{display:'none', duration: 300, easing:'easeOutSine'});

		// $('#powerRing4').velocity({scaleX:[3, 0.5], scaleY:[3, 0.5], opacity:[1,0], rotateZ:[particles.randomPos(50),particles.randomPos(50)]},{display:'block', duration: 600, easing:'easeInSine', delay: 2800});
		// $('#powerRing4').velocity({scaleX: 8, scaleY:8, opacity: 0},{display:'none', duration: 300, easing:'easeOutSine'});
		
		// $('#powerRing5').velocity({scaleX:[3, 0.5], scaleY:[3, 0.5], opacity:[1,0], rotateZ:[particles.randomPos(50),particles.randomPos(50)]},{display:'block', duration: 600, easing:'easeInSine', delay: 3200});
		// $('#powerRing5').velocity({scaleX: 8, scaleY:8, opacity: 0},{display:'none', duration: 300, easing:'easeOutSine'});
				
		$('#rimGlow, #midOverlay, #magicSwirl1, #magicSwirl2').velocity({ opacity: 0}, { display: "none", delay: 1000, duration: 2000, complete: function(){
			$('.effects, #effectsButton').hide();
			closeRim();
			setTimeout(animationComplete, 2000);
		} });
	},2000);
}

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
	luckyVariables.buttonReady = true;
	luckyVariables.buttonReleased = false;
	luckyVariables.textRunning = true;
	fireEvent('Animation Complete', 'Animation Complete');
	// if(luckyVariables.luckyPresses == 1){
	// 	screenText.textQueue(['You are now','LUCKY!','Press again','for more luck']);
	// } else if (luckyVariables.luckyPresses < 4){
	// 	screenText.textQueue(['You are now', screenText.adverbs[Math.floor(Math.random() * screenText.adverbs.length)] ,'LUCKY!','Press again','for more luck']);
	// } else  if (luckyVariables.luckyPresses < 8){
	// 	screenText.textQueue(['You are now', screenText.adverbs[Math.floor(Math.random() * screenText.adverbs.length)], screenText.adverbs[Math.floor(Math.random() * screenText.adverbs.length)] ,'LUCKY!','Press again','for more luck']);
	// } else {
	// 	screenText.textQueue(['You are now', screenText.adverbs[Math.floor(Math.random() * screenText.adverbs.length)], screenText.adverbs[Math.floor(Math.random() * screenText.adverbs.length)], screenText.adverbs[Math.floor(Math.random() * screenText.adverbs.length)] ,'LUCKY!','Press again','for more luck']);
	// }
	screenText.youAreNowLucky(luckyVariables.luckyPresses);
}

var luckyEffects = ['powerStreams', 'spinningRim', 'buttonFall', 'cloudsTunnelOpen', 'luckySymbol', 'rimLight'];

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex ;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

shuffle(luckyEffects);