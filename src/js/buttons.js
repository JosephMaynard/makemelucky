if(luckyVariables.android){
	$('#button').replaceWith('<div id="button"></div>');
} else {
	$('#button').replaceWith('<div id="button"><div id="glint"><div id="glintLine"></div></div></div>');
}

$('#button').on('touchstart, mousedown', function(event){
	fireEvent('Button Pressed', 'Presses: ' + (luckyVariables.luckyPresses + 1));
	fireEvent('Total Presses', 'Total Presses: ' + (luckyVariables.luckStore.luckyness + 1));
	event.preventDefault();
	if(luckyVariables.buttonReady){
		luckyVariables.buttonReady = false;
		sound.play('button');
		vibrate(5);
		$('#glint').velocity({opacity: 0},{duration:100, display: 'none'});
		$('#button').velocity({scaleX:0.98, scaleY:0.98},{duration:100});
		clearInterval(screenText.setInterval);
		$('.screenText').addClass('screenTextOut');
		luckyVariables.textRunning = false;
		setTimeout(function(){
			$('.screenText > p, #screenText1, #screenText6').html("");
			$('.screenText').removeClass('screenTextOut');
		},300);
	} 
	return false;
});

$('#button').on('contextmenu', '*', function(e){ return false; });

$('#button').on('touchend, touchcancel, touchleave, mouseup', function(event){
	event.preventDefault();
	//console.log(event);
	if(!luckyVariables.buttonReleased){
		luckyVariables.buttonReleased = true;
		$('#glint').show();
		$('#button').velocity({scaleX:1, scaleY:1},{duration:100, complete: function(){
			//luckyVariables.buttonReady = true;
			window[luckyEffects[(luckyVariables.luckyPresses % luckyEffects.length)]]();
			fireEvent('Effect Started', luckyEffects[(luckyVariables.luckyPresses % luckyEffects.length)]);
			luckyVariables.luckyPresses++;
			luckyVariables.luckStore.luckyness++;
			if(luckyVariables.pressesArray.indexOf(luckyVariables.luckStore.luckyness) != -1){
				//Award Charm
				//console.log('You earned a Luck Charm');
				for(var x in luckyCharms.presses){
					if(luckyCharms.presses[x].amount == luckyVariables.luckStore.luckyness){
						awardLuckyCharm(luckyCharms.presses[x]);
					}
				}
			}
			storeTheLuck();
		}});
	}
	return false;
});

$('.socialMediaLink').click(function(e){
	e.preventDefault();
	if($(this).attr('id') == 'Facebook' && !luckyVariables.luckStore.specialCharms.facebook){
		luckyVariables.luckStore.specialCharms.facebook = true;
		awardLuckyCharm(luckyCharms.social.facebook);
		storeTheLuck();
	} else if($(this).attr('id') == 'Twitter' && !luckyVariables.luckStore.specialCharms.twitter){
		luckyVariables.luckStore.specialCharms.twitter = true;
		awardLuckyCharm(luckyCharms.social.twitter);
		storeTheLuck();
	} else if($(this).attr('id') == 'Pinterest' && !luckyVariables.luckStore.specialCharms.pinterest){
		luckyVariables.luckStore.specialCharms.pinterest = true;
		awardLuckyCharm(luckyCharms.social.pinterest);
		storeTheLuck();
	} else if($(this).attr('id') == 'WhatsApp' && !luckyVariables.luckStore.specialCharms.whatsapp){
		luckyVariables.luckStore.specialCharms.whatsapp = true;
		awardLuckyCharm(luckyCharms.social.whatsapp);
		storeTheLuck();
	} else if($(this).attr('id') == 'GooglePlus' && !luckyVariables.luckStore.specialCharms.googleplus){
		luckyVariables.luckStore.specialCharms.googleplus = true;
		awardLuckyCharm(luckyCharms.social.googleplus);
		storeTheLuck();
	} else if($(this).attr('id') == 'Email' && !luckyVariables.luckStore.specialCharms.email){
		luckyVariables.luckStore.specialCharms.email = true;
		awardLuckyCharm(luckyCharms.social.email);
		storeTheLuck();
	} else if($(this).attr('id') == 'LinkedIn' && !luckyVariables.luckStore.specialCharms.linkedin){
		luckyVariables.luckStore.specialCharms.linkedin = true;
		awardLuckyCharm(luckyCharms.social.linkedin);
		storeTheLuck();
	} else if($(this).attr('id') == 'Buffer' && !luckyVariables.luckStore.specialCharms.buffer){
		luckyVariables.luckStore.specialCharms.buffer = true;
		awardLuckyCharm(luckyCharms.social.buffer);
		storeTheLuck();
	} else if($(this).attr('id') == 'StumbleUpon' && !luckyVariables.luckStore.specialCharms.stumbleupon){
		luckyVariables.luckStore.specialCharms.stumbleupon = true;
		awardLuckyCharm(luckyCharms.social.stumbleupon);
		storeTheLuck();
	}
	var href = $(this).attr('href');
	fireEvent('Social Media Button', $(this).attr('id'));
	if (window.location.protocol != 'file:') {
		setTimeout(function(){
			window.location.assign(href);
		}, 300);
	} else {
		console.log("Go to: " + href);
	}
});

$('#pageDownOverlay').click(function(){
	$('#pageDownTarget').velocity("scroll", { duration: 1300, easing: [400,15], offset: 0  + ($('#pageDownTarget').height() * 0.2)});
	fireEvent('Page Down Button Click','Page Down Button Click');
});

$('#pageUp').click(function(){
	$('#adStrip').velocity("scroll", { duration: 800, easing: 'easeOutCubic'});
	fireEvent('Page Up Button Click','Page Up Button Click');
});

$('#muteOverlay').click(function(){
	console.log('Mute');
	if(luckyVariables.luckStore.soundOn){
		luckyVariables.luckStore.soundOn = false;
		luckyVariables.luckStore.vibrationOn = false;
		sound.mute();
		sound.volume(0);
		$('#muteIcon').css('backgroundPosition', '100% 50%');
		fireEvent('Mute Button Click','Mute');
	} else {
		luckyVariables.luckStore.soundOn = true;
		luckyVariables.luckStore.vibrationOn = true;
		sound.unmute();
		sound.volume(1);
		$('#muteIcon').css('backgroundPosition', '0% 50%');
		fireEvent('Mute Button Click','Unmute');
	}
	storeTheLuck();
});