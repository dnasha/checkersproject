/*
+---+
|   |
+---+
*/

// computer representation of the position
class Position {
	constructor(wcs, bcs, posBoard, wkc, bkc, wcc, bcc, moveCount, turn) {
		this.wcs = wcs;
		this.bcs = bcs;
		this.wcc = wcc;
		this.bcc = bcc;
		this.wkc = wkc;
		this.bkc = bkc;
		this.moveCount = moveCount;
		this.posBoard = posBoard;
		this.turn = turn;
	}

	toString() {
		var textRep = "";
		var posBoard = this.posBoard;
		
		for (let i = 0; i < posBoard.length; i ++) {
			textRep += "+---+---+---+---+---+---+---+---+\n"
			textRep += "|"
			for (let j = 0; j < posBoard[i].length; j ++) {
				if (posBoard[i][j] == null) {
					textRep += "   |";
				} else {
					textRep += " " + posBoard[i][j].color +" |";
				}
			}
			textRep += "\n"
		}

		textRep += "+---+---+---+---+---+---+---+---+\n";

		textRep += "White Count: " + this.wcc + "\n";
		textRep += "Black Count: " + this.bcc + "\n";
		textRep += "";

  		return textRep;
  	}
	copy() {
		return new Position(this.wcs, this.bcs, this.posBoard, this.wkc, this.bkc, this.wcc, this.bcc, this.moveCount, this.turn);
	}
}

export {Position}