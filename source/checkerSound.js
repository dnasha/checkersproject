// the checker sound class is quite simple
// it is responsible for all of the sounds that
// one hears while playing.

class checkerSound {
	constructor() {
		this.start = document.getElementById("startAUD");
		this.move = document.getElementById("moveAUD");
		this.attack = document.getElementById("attackAUD");
		this.check = document.getElementById("checkAUD");
		this.win = document.getElementById("winAUD");
	}

	startS() {
		this.start.play();
	}

	moveS() {
		this.move.play();
	}

	attackS() {
		this.attack.play();
	}

	checkS() {
		this.check.play();
	}

	winS() {
		this.win.play();
	}
}

export { checkerSound };
