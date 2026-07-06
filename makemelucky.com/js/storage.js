var luckyVariables = {
	ver: 0.35,
	luckyPresses: 0,
	currentTime: new Date(),
	localStorageAvailable: testLocalStorage(),
	buttonReady: true,
	buttonReleased: false,
	android: navigator.userAgent.match(/Android/i),
	textRunning: true,
	luckStore: {
		luckyness:0,
		visits:1,
		longestPress:0,
		daysInRow:0, 
		version: this.ver,
		charms: [],
		specialCharms: {},
		soundOn: true,
		vibrationOn:true,
		firstUse: new Date().toISOString()
	},
	charmAwarded: false
};

function testLocalStorage(){
	var test = 'test';
    try {
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch(e) {
        return false;
    }
}

if(luckyVariables.localStorageAvailable){
	if(window.localStorage.getItem('luckStore')){
		luckyVariables.luckStore = JSON.parse(localStorage.getItem('luckStore'));
		//Delete local storage on old versions
		if(luckyVariables.luckStore.version < 0.35 ){
			localStorage.clear();
			createLuckStore();
		} else {	
			luckyVariables.firstUse = new Date(Date.parse(luckyVariables.luckStore.firstUse));

			//Calculate Visits
			if(luckyVariables.currentTime - luckyVariables.firstUse > 3600000){
				luckyVariables.luckStore.visits = luckyVariables.luckStore.visits + 1;
				for(var x in luckyCharms.visits){
					if(luckyCharms.visits[x].amount == luckyVariables.luckStore.visits){
						//Award Charm
						console.log('You have earned the ' + luckyCharms.visits[x].title + ' Lucky Charm!');
						awardLuckyCharm(luckyCharms.visits[x]);
					}
				}
			}

			//Update version
			if(luckyVariables.luckStore.version != luckyVariables.ver){
				//Update function
				luckyVariables.luckStore.version = luckyVariables.ver;
			}
			//Add Charms to page
			if(luckyVariables.luckStore.charms.length > 0){
				for (var i = 0; i < luckyVariables.luckStore.charms.length; i++) {
					appendCharm(luckyVariables.luckStore.charms[i]);
				}
			}

			storeTheLuck();
		}
	} else {
		createLuckStore();
	}
} else {
	$('#luckyCharms').hide();
}

function createLuckStore(){
	luckyVariables.luckStore = {
		luckyness:0,
		visits:1,
		longestPress:0,
		daysInRow:0,
		version: this.ver,
		charms: [],
		specialCharms: {},
		soundOn: true,
		vibrationOn:true,
		firstUse: new Date().toISOString()
	};
	storeTheLuck();
}

function storeTheLuck(){
	if(luckyVariables.localStorageAvailable){
		var dataToStore = JSON.stringify(luckyVariables.luckStore);
		localStorage.setItem('luckStore', dataToStore);
	}
}