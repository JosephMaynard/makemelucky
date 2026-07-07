function resizeWindow(){
	$('#mainArea').height(window.innerHeight);
	if( $('.luckBox').outerHeight() < $('.luckyAreaContainer').outerHeight() - $('#adStrip').outerHeight() ){
		$('.luckBox').css('top', ($('.luckyAreaContainer').outerHeight() - $('.luckBox').outerHeight() - $('#adStrip').outerHeight()) / 2 + ($('#adStrip').outerHeight() / 3) + 'px');
	}
}

resizeWindow();

function hideLoadingScreen(){
	window.scrollTo(0,0);
	$('#loadingSpinner').velocity({ opacity: 0, scaleX:2, scaleY:2 }, { display: "none", duration: 1000, easing: 'easeInCubic' });
	$('#loading').velocity({ opacity: 0 }, { display: "none", duration: 1000, easing: 'easeInCubic', complete: function(){
		setTimeout(screenText.welcome, 100);
	} });
}


$(window).resize(function(){
	resizeWindow();
});

var imageList = ['loading_ring_back.png', 'loading_ring_front.png', 'clouds.png', 'rim_top.png', 'rim_right.png', 'rim_bottom.png', 'rim_left.png', 'lucky_symbol.png', 'rim_light.png', 'cloud_tunnel.png', 'outer_light.png', 'power_stream.png', 'rim_glow.png', 'magic_swirl.png', 'screen.png', 'luckyStar.png', 'shootingStar.png', 'downButton.png', 'vignette.png', 'leather_texture.jpg', 'outer_rim.png', 'clamps.png', 'cog.png', 'spacer.png', 'rim.png', 'button.png', 'rim_spinning.png', 'glow_closed.png', 'glow_open.png', 'button_glowing.png', 'spark1.png', 'spark2.png', 'spark3.png', 'spark4.png', 'social_media_icons.png', 'power_ring.png'];

function preLoadImages(imageArray, callBack, path){
	if (typeof callBack === 'undefined') { callBack = function(){console.log('All images loaded.')}; }
	if (typeof path === 'undefined') { path = ''; }
	var preLoadedImages = [],
		loadedImages = 0;
	for (var i = 0; i < imageArray.length; i++) {
		preLoadedImages[i] = new Image();
		preLoadedImages[i].onload = function(){
			loadedImages++;
			if(loadedImages == imageArray.length){
				callBack();
			}
		}
		preLoadedImages[i].src = path + imageArray[i];
	}
}

function pageLoaded(){
	createCharmsArrays();
	resizeWindow();	
	//screenText.textQueue([screenText.welcome, screenText.needLuck, screenText.press]);
	$('#screenText3 .line1, #screenText3 .line2').html("");
	if(luckyVariables.luckStore.soundOn == false){
		sound.mute();
		sound.volume(0);
	}
	fireEvent('Page Loaded', 'Visits: ' + luckyVariables.luckStore.visits);
	setTimeout(hideLoadingScreen, 300);
}


preLoadImages(imageList, pageLoaded, 'img/' );