//Notice that lucky and luckyness are declared but not defined
var lucky;
var luckyness;
var messages = ['You are now lucky!', 'You are now even luckier!!', 'You are now really LUCKY!!!', 'You are now super LUCKY!!!', 'You are now SUPER SUPER LUCKY!!!', 'You are now really quite amazingly LUCKY!!!!', 'You are now unbelievably LUCKY!!!!', 'You are now so incredibly lucky it may not be possible to be any LUCKIER!!!', 'Holy Moly! You are actually now even LUCKIER!!!'];
var buttonReady = true;

makeLucky = function () {
	//Here's where the magic happens!
	if (lucky) {
		luckyness = luckyness + 1;
	} else {
		lucky = true;
		luckyness = 1;
	}
	//There you go, anyone who knows anything about programming will be able to see that lucky is true, and the value of luckyness has increased!
}

resetButton = function () {
	$('#button').removeClass('buttonPressed');
	buttonReady = true;
}

luckyStars = function () {
	var halfWidth = $('#container').width() / 2;
	emitter.makeExplosion(halfWidth, -300, 0)
}

$('#button').click(function(){
	if (buttonReady) {
		buttonReady = false;
		$('#button').addClass('buttonPressed');
			makeLucky();
			setTimeout(luckyStars, 500);  
		if (luckyness < 10){
			$('#output').html('<span class="newMessage">' + messages[luckyness - 1] + '</span>');
		} else {
			$('#output').html('<span class="newMessage">You are now SUPER MEGA EXTRA LUCKY x' + luckyness + '</span>');
		}
		_gaq.push(['_trackEvent', 'Luck Button', 'Pressed', 'Now Lucky']);
		setTimeout(resetButton, 1010); 
	}
});

$('#aboutBtn').click(function(e){
	e.preventDefault();
	$('#home').hide();
	$('#about').show();
});

$('#homeBtn').click(function(e){
	e.preventDefault();
	$('#about').hide();
	$('#home').show();
});

//Hide Address Bar
window.addEventListener("load",function() {
    setTimeout(function(){
        window.scrollTo(0, 1);
    }, 0);
});




// Particle code by Seb Lee-Delisle, sebleedelisle.com
// Taken from CreativeJS Create an iPad Optimised Game
// http://creativejs.com/tutorials/create-an-ipad-optimised-game/


// DOM elements
var container =	document.getElementById('container');

// the particle emitter
emitter = new Emitter(container); 

function Emitter(domContainer){
	
	var particles=[], 
		spareParticles=[];
		
	this.container = domContainer;  
	
	this.update = function(){
		
		for(var i=0; i<particles.length; i++){
			var particle = particles[i]; 
			if(!particle.enabled) continue; 
			particle.update(); 
			if(!particle.enabled) this.removeParticle(particle); 
		}
		
	};
	
	this.removeParticle = function(particle) {
		particle.domElement.style.visibility = "hidden"; 
		particle.enabled = false; 
		spareParticles.push(particle); 
	};
	
	this.makeExplosion = function(xpos, ypos, zpos){
		
		for(var i=0; i<30; i++) {
			var particle = this.makeParticle(); 
			particle.x = xpos; 
			particle.y = ypos; 
			particle.z = zpos; 
			
			particle.xVel = Math.random() - 0.5; 
			particle.yVel = Math.random() - 0.5; 
			particle.zVel = Math.random() - 0.5;
			
			var speed = Math.sqrt((particle.xVel * particle.xVel)+(particle.yVel * particle.yVel)+(particle.zVel * particle.zVel));
			particle.xVel *= 40/speed;
			particle.yVel *= 40/speed;
			particle.zVel *= 40/speed;
			
			particle.size = 1.5; 
		
			particle.update(); 
			
		}
		
	};	
	
	this.makeParticle = function(){
		
		var particle; 
		
		if(spareParticles.length>0){
			particle = spareParticles.shift();
			particle.domElement.style.visibility = "visible"; 
		
		} else {
			particle = new Particle(); 
			particles.push(particle); 
			this.container.appendChild(particle.domElement);
		}
		
		particle.enabled = true;  
	
		return particle; 
		
	};
	
}

function Particle(){
	
	var domElement = this.domElement = document.createElement('div');

	this.domElement.style.background = 'url(luckyStar.png) transparent'; 
	
	domElement.style.position = 'absolute';
	domElement.style.display = 'block'; 
	domElement.style.width = "32px"; 
	domElement.style.height = "32px";
	domElement.style.webkitTransformOrigin = "16px 16px"; 
	
	this.x = 0; 
	this.y = 0;
	this.z = 0; 
	this.xVel = 0; 
	this.yVel = 0; 
	this.zVel = 0; 
	this.size = 1; 
	
	this.enabled = true; 
	
	this.update = function(){
		
		var drag = 0.85; 
		
		this.xVel*=drag; 
		this.yVel*=drag; 
		this.zVel*=drag; 
		
		this.x+=this.xVel; 
		this.y+=this.yVel; 
		this.z+=this.zVel; 
		
		this.size*=0.9; 

		domElement.style.webkitTransform = "translate3d("+this.x+"px, "+this.y+"px, "+this.z+"px) scale("+this.size+")"; 
		
		if(this.size<0.05) this.enabled = false; 

	};
	
}