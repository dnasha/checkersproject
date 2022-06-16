class PieceTracker {
	constructor (pieces) {
		this.pieces = pieces;
	}

	show() {
		var temp = this.pieces;

		var i = 0;
		while (temp.item(i).style.visibility === "visible" && i < temp.length) {
			i ++;
		}

		temp.item(i).style.visibility = "visible";
	}

	reset() {
		var temp = this.pieces;

		for (let i = 0; i < temp.length; i ++) {
			temp.item(i).style.visibility = "hidden";
		}
	}
}

export {PieceTracker}