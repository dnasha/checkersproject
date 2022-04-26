/*
+---+
|   |
+---+
*/
import {Checker} from "./checker.js";
import {Move} from "./move.js";

// computer representation of the position
class Position {
	constructor(wcs, bcs, posBoard, wkc, bkc, wcc, bcc, moveCount, turn, prevMove) {
		this.wcs = wcs;
		this.bcs = bcs;
		this.wcc = wcc;
		this.bcc = bcc;
		this.wkc = wkc;
		this.bkc = bkc;
		this.moveCount = moveCount;
		this.posBoard = posBoard;
		this.turn = turn;
		this.prevMove = prevMove;
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
		textRep += "Move: " + this.prevMove.toString();

  		return textRep;
  	}

	// deep copies the current self
	// by expanding objects to the primitive type level
	// and reassigning everything to a copy
	copy() {
		var tempWCS = this.wcs;
		var tempBCS = this.bcs;
		
		var nwcs = [];

		for (let i = 0; i < tempWCS.length; i ++) {
			
			let x = tempWCS[i].location[0];
			let y = tempWCS[i].location[1];
			
			let king = tempWCS[i].king;
			
			let source = tempWCS[i].source;
			
			nwcs.push(new Checker([x, y], "W", source, king));
		}
		
		var nbcs = [];

		for (let i = 0; i < tempBCS.length; i ++) {
			
			let x = tempBCS[i].location[0];
			let y = tempBCS[i].location[1];
			
			let king = tempBCS[i].king;
			
			let source = tempBCS[i].source;
			
			nbcs.push(new Checker([x, y], "B", source, king));
		}
		
		var nposBoard = [];

		var tempBoard = this.posBoard;
		
		for (let i = 0; i < tempBoard.length; i ++) {
			nposBoard.push([]);
			
			for (let j = 0; j < tempBoard[i].length; j ++) {
				var current = tempBoard[i][j];

				if (current == null) {
					nposBoard[i].push(null);
				} else if (current.color == "W") {
					nposBoard[i].push(nwcs[tempWCS.indexOf(current)]);
				} else if (current.color == "B") {
					nposBoard[i].push(nbcs[tempBCS.indexOf(current)]);
				}
				
			}
		}

		
		let nwkc = this.wkc;
		let nbkc = this.bkc;
		let nwcc = this.wcc;
		let nbcc = this.bcc;
		let nmoveCount = this.moveCount;
		let nturn = this.turn;
		
		var tempMove = this.prevMove;

		var x = tempMove.cords[0];
		var y = tempMove.cords[1];
		var type = tempMove.type;
		var tempPiece = tempMove.piece;
		

		let xp = tempPiece.location[0];
		let yp = tempPiece.location[1];	
		let king = tempPiece.king;
		let source = tempPiece.source;
		let color = tempPiece.color;
		
		var piece =	new Checker([xp, yp], color, source, king);
		
		let nprevMove = new Move(piece, [x,y], type);
		
		return new Position(nwcs, nbcs, nposBoard, nwkc, nbkc, nwcc, nbcc, nmoveCount, nturn, nprevMove);
	}

	gameOver() {
		if (this.wpc == 0 || this.bpc == 0) {
			return true;
		}

		return false;
	}
}

export {Position}