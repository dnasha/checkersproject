// the checker piece
class Checker {
	constructor(location, color, source, king, index) {
		// collumn, row
		//[x,y]
		this.location = location;
		this.color = color;
		this.source = source;
		this.king = king;
		this.dead = false;
		this.index = index;
	}

	toString() {
		return this.color + " " + this.king;
	}

	equals(piece) {
		if (piece.location[0] == this.location[0] &&
		   piece.location[1] == this.location[1] &&
		   piece.color == this.color && piece.source == this.source &&
		   piece.king == this.king && piece.dead == this.dead) {
			return true;
		} else {
			return false;
		}
	}

	type() {
		if (this.color === "W"){
			return true;
		} 
		return false;
	}
}

export {Checker}