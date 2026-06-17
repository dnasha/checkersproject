// the piece tracker class is responsible for showing or hiding
// those little piece trackers next to either of the timers
// it helps players visualise how much they are up or down by in terms
// of piece count

class PieceTracker {
	constructor(pieces) {
		this.pieces = pieces;
	}

	show() {
		var temp = this.pieces;

		var i = 0;
		while (i < temp.length && temp.item(i).style.visibility === "visible") {
			i++;
		}

		if (i < temp.length) {
			temp.item(i).style.visibility = "visible";
		}
	}

	reset() {
		var temp = this.pieces;

		for (let i = 0; i < temp.length; i++) {
			temp.item(i).style.visibility = "hidden";
		}
	}
}

export { PieceTracker };
