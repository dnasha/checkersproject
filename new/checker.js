// the checker piece
class Checker {
	constructor(location, color, source, king) {
		// row, collumn
		//[y,x]
		this.location = location;
		this.color = color;
		this.source = source;
		this.king = king;
	}

	toString() {
		return this.color + " " + this.king;
	}

	equals(piece) {
		if (piece.location[0] == this.location[0] &&
		   piece.location[1] == this.location[1] &&
		   piece.color == this.color && piece.source == this.source &&
		   piece.king == this.king) {
			return true;
		} else {
			return false;
		}
	}
}

export {Checker}