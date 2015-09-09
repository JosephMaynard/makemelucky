function resizeWindow(){
	$('#mainArea').height(window.innerHeight);
	if( $('.luckBox').outerHeight() < window.innerHeight - $('#adStrip').outerHeight() ){
		$('.luckBox').css('top', Math.round(window.innerHeight - $('.luckBox').outerHeight() - $('#adStrip').outerHeight()) / 2 + $('#adStrip').outerHeight() + 'px');
		$('.luckyAreaContainer').css('width', '100%');
		$('#screen').css('font-size','1em')
	} else if( ($('.luckBox').outerHeight() * 0.75) < window.innerHeight - $('#adStrip').outerHeight() ){
		$('.luckBox').css('top', ($('#adStrip').outerHeight() - 5) + 'px');
		$('.luckyAreaContainer').css('width', Math.round((window.innerHeight - $('#adStrip').outerHeight()) / 1.2) + 'px');
		$('#screen').css('font-size', Math.round((window.innerHeight - $('#adStrip').outerHeight()) / 1.2) / 550 + 'em')
	} else {
		$('.luckBox').css('top', ($('#adStrip').outerHeight() - 5) + 'px');
		$('.luckyAreaContainer').css('width', '100%');
		$('#screen').css('font-size','1em')
	}
}

function makeMeLucky(){
	if(!luckyVariables.luckStore.specialCharms.hacker){
		luckyVariables.luckStore.specialCharms.hacker = true;
		awardLuckyCharm(luckyCharms.social.hacker);
		storeTheLuck();
	}
	return 'You are now LUCKY!';
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

var imageList = ['loading_ring_back.png', 'loading_ring_front.png', 'clouds.png', 'rim_top.png', 'rim_right.png', 'rim_bottom.png', 'rim_left.png', 'lucky_symbol.png', 'rim_light.png', 'cloud_tunnel.png', 'outer_light.png', 'power_stream.png', 'rim_glow.png', 'magic_swirl.png', 'screen.png', 'luckyStar.png', 'shootingStar.png', 'downButton.png', 'vignette.png', 'leather_texture.jpg', 'outer_rim.png', 'clamps.png', 'cog.png', 'spacer.png', 'rim.png', 'button.png', 'rim_spinning.png', 'glow_closed.png', 'glow_open.png', 'button_glowing.png', 'spark1.png', 'spark2.png', 'spark3.png', 'spark4.png', 'social_media_icons.png', 'power_ring.png', 'muteButton.png', 'inside_mech_bkg.jpg', 'leather_texture_brown.jpg', 'screen_inner.png', 'page_up.png'];

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
	if (window.location.protocol != 'file:') {
		$('#facebookLike').html('<iframe src="//www.facebook.com/plugins/like.php?href=http%3A%2F%2Fmakemelucky.com&amp;send=false&amp;layout=box_count&amp;width=55&amp;show_faces=true&amp;font&amp;colorscheme=light&amp;action=like&amp;height=65&amp;appId=423609547672506" scrolling="no" frameborder="0" style="border:none; overflow:hidden; width:55px; height:65px;" allowTransparency="true"></iframe>');
	}
	createCharmsArrays();
	resizeWindow();	
	//screenText.textQueue([screenText.welcome, screenText.needLuck, screenText.press]);
	$('#screenText3 .line1, #screenText3 .line2').html("");
	if(luckyVariables.luckStore.soundOn == false){
		sound.mute();
		sound.volume(0);
		$('#muteIcon').css('backgroundPosition', '100% 50%');
	}
	fireEvent('Page Loaded', 'Visits: ' + luckyVariables.luckStore.visits);
	console.log('Welcome to Make Me Lucky! Version: ', luckyVariables.ver);
	$('body, html').css({'overflow':'auto','height':'auto'});
	setTimeout(hideLoadingScreen, 300);
}

$('body, html').css({'overflow':'hidden','height':'100%'});

preLoadImages(imageList, pageLoaded, 'img/' );

var scrolledItems = {
	pageUp: false
};

$(window).scroll(function() {

    var topOfWindow = $(window).scrollTop(),
        bottomOfWindow = topOfWindow + $(window).height();

    $('.card, #footer, #smallprint').each(function(){
        var cardPos = $(this).offset().top;

        if (cardPos < topOfWindow + 50 && !scrolledItems[this.id]) {
        		scrolledItems[this.id] = true;
                fireEvent('Scroll Point', this.id);
        }
    });

    if(topOfWindow > $('#pageDownTarget').height()){
    	if(!scrolledItems.pageUp){
	    	$('#pageUp').velocity({opacity:1, translateY: [0,90]},{duration: 300});
	    	scrolledItems.pageUp = true;
    	}
    } else {
    	if(scrolledItems.pageUp){
	    	$('#pageUp').velocity({opacity:0, translateY: [90,0]},{duration: 300});
	    	scrolledItems.pageUp = false;
    	}
    }

});