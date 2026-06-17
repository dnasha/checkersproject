import { Checker } from "./checker.js";
import { Move } from "./move.js";

// fpos stands for fysical (physical) position

// the fpos class is an
// object/mathematical representation of the game state/position/board data

// it is practically a collection of data that powers 90% of the
// algorithims within this project
class Position {
	constructor(
		wcs,
		bcs,
		posBoard,
		wkc,
		bkc,
		wcc,
		bcc,
		moveCount,
		turn,
		prevMove,
	) {
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

		for (let i = 0; i < posBoard.length; i++) {
			textRep += "+---+---+---+---+---+---+---+---+\n";
			textRep += "|";
			for (let j = 0; j < posBoard[i].length; j++) {
				if (posBoard[i][j] == null) {
					textRep += "   |";
				} else {
					textRep += " " + posBoard[i][j].color + " |";
				}
			}
			textRep += "\n";
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
	// quite useless given that it got replaced by lodash
	// in the recent most checkpoint
	copy() {
		var tempWCS = this.wcs;
		var tempBCS = this.bcs;

		var nwcs = [];

		for (let i = 0; i < tempWCS.length; i++) {
			const x = tempWCS[i].location[0];
			const y = tempWCS[i].location[1];

			const king = tempWCS[i].king;

			const source = tempWCS[i].source;

			nwcs.push(new Checker([x, y], "W", source, king));
		}

		var nbcs = [];

		for (let i = 0; i < tempBCS.length; i++) {
			const x = tempBCS[i].location[0];
			const y = tempBCS[i].location[1];

			const king = tempBCS[i].king;

			const source = tempBCS[i].source;

			nbcs.push(new Checker([x, y], "B", source, king));
		}

		var nposBoard = [];

		var tempBoard = this.posBoard;

		for (let i = 0; i < tempBoard.length; i++) {
			nposBoard.push([]);

			for (let j = 0; j < tempBoard[i].length; j++) {
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

		const nwkc = this.wkc;
		const nbkc = this.bkc;
		const nwcc = this.wcc;
		const nbcc = this.bcc;
		const nmoveCount = this.moveCount;
		const nturn = this.turn;

		var tempMove = this.prevMove;

		var x = tempMove.cords[0];
		var y = tempMove.cords[1];
		var type = tempMove.type;
		var tempPiece = tempMove.piece;

		const xp = tempPiece.location[0];
		const yp = tempPiece.location[1];
		const king = tempPiece.king;
		const source = tempPiece.source;
		const color = tempPiece.color;

		var piece = new Checker([xp, yp], color, source, king);

		const nprevMove = new Move(piece, [x, y], type);
		return new Position(
			nwcs,
			nbcs,
			nposBoard,
			nwkc,
			nbkc,
			nwcc,
			nbcc,
			nmoveCount,
			nturn,
			nprevMove,
		);
	}

	// checks if the current position has a game over.
	// it doesn't incorporate every win condition like the game class does
	// but it is good enough to incentivise the AI to make the game over/win.
	gameOver() {
		if (this.wcc == 0 || this.bcc == 0) {
			return true;
		}

		return false;
	}
}

export { Position };
