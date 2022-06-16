class Move {
	constructor (piece, cords, type) {
		this.piece = piece;
		this.type = type;
		this.cords = cords;
	}

	toString() {
		return this.piece.location + " -> " + this.type + ": " + this.cords;
	}

	equals(move) {
		if (move.piece.equals(this.piece) && move.type ==
			this.type && move.cords[0] == this.cords[0] 
			&& move.cords[1] == this.cords[1]) {
			return true;
		} else {
			return false;
		}
	}
}

export {Move}