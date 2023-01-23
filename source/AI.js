import { Move } from "./move.js";

// The AI class is responsible for playing against the player when enabled
// It uses the MiniMax algorithm and an evaluation heuristic to account
// for several moves in the future and determine the best move to make in the
// present
class AI {

	constructor(currentPos) {
		this.position = currentPos;
		this.stats = 0;
		this.time = 180;
	}

	// main function that reaches out to the helper methods
	// to generate the move that the AI wants to make
	getMove() {
		var start = Date.now();

		var score = [-Infinity, this.position];

		var positions = this.getPositions(this.position);

		// going through posible initial branches
		// of outcomes to grade them and pick
		// the best one
		var depth = 5;
		for (let i = 0; i < positions.length; i++) {
			depth = 5;
			let current = positions[i];

			if (current.wcc + current.bcc + current.wkc + current.bkc < 8) {
				depth = 7;
			}

			if (this.time < 30) {
				depth = 4;
			}

			var temp = this.minMax(current, false, depth, -Infinity, Infinity);

			if (temp > score[0]) {
				score[0] = temp;
				score[1] = positions[i];
			}

		}

		var stats = this.stats;

		console.log("Positions Calculated: " + stats);
		console.log("Time taken (s): " + (Date.now() - start) / 1000);
		console.log("Score: " + score[0]);
		let best = score[1];

		let piece = best.prevMove.piece;
		let type = best.prevMove.type;
		let cords = best.prevMove.cords;
		let optimalMove = new Move(piece, cords, type);

		return optimalMove;
	}

	// refreshes the current fields within the class
	update(newPos, time) {
		this.position = newPos;
		this.stats = 0;
		this.time = time;
	}

	// this function takes a position and
	// applies a move to it to help the 
	// algorithm see the outcome of that move
	updatePosboard(position, move) {

		let board = position.posBoard;
		let cords = move.cords;
		let type = move.type;
		let oldPiece = move.piece;
		let px = oldPiece.location[0];
		let py = oldPiece.location[1];
		let mx = cords[0];
		let my = cords[1];
		let piece = board[py][px];
		position.prevMove = new Move(piece, [mx, my], type);


		if (piece.color === "B") {
			position.turn = true;
			if (!piece.king && my == 7) {
				piece.king = true;
				position.bkc++;
			}
		} else {
			position.turn = false;
			if (!piece.king && my == 0) {
				piece.king = true;
				position.wkc++;
			}
		}

		board[my][mx] = piece;
		board[py][px] = null;


		if (type) {
			var attacked = board[Math.round((py + my) / 2)][Math.round((px + mx) / 2)];
			if (attacked.color === "W") {
				position.wcc--;

				if (attacked.king) {
					position.wkc--;
				}
			} else {
				position.bcc--;

				if (attacked.king) {
					position.bkc--;
				}
			}

			attacked.dead = true;
			board[attacked.location[1]][attacked.location[0]] = null;

			// var moves = this.possibleMoves(position, piece);

			// for (let i = 0; i < moves.length; i ++) {
			// 	var current = moves[i];

			// 	if (current.type = true) {
			// 		this.updatePosboard(position, current);
			// 		i = moves.length;
			// 	}
			// }
		}

		piece.location = [mx, my];
	}

	gameOver(position) {
		if (position.wpc == 0 || position.bpc == 0) {
			return true;
		}

		return false;
	}

	// this function grades how good a move is
	// for the ai
	// the higher the score, the better the move
	evaluate(position) {
		var wcc = position.wcc;
		var bcc = position.bcc;
		var wkc = position.wkc;
		var bkc = position.bkc;


		if (this.gameOver(position)) {
			if (position.turn) {
				return 1000;
			} else {
				return -1000;
			}
		}

		let score = bcc - wcc + (2 * (bkc - wkc));

		score += this.positionalEval(position);
		return score;
	}

	positionalEval(position) {
		var scoring = 0;

		for (let i = 0; i < 8; i++) {

			for (let j = 0; j < 8; j++) {

				if (position.posBoard[i][j] == null) {
					continue;
				}

				if (position.posBoard[i][j].type()) {
					if (i == 0 || i == 7) {
						scoring -= 0.05;
					}

					if (i > 1 && i < 6) {
						scoring -= 0.1;
					}

					if (i > 2 && i < 5) {
						scoring -= 0.15;
					}

				} else {
					if (i == 0 || i == 7) {
						scoring += 0.05;
					}

					if (i > 1 && i < 6) {
						scoring += 0.1;
					}

					if (i > 2 && i < 5) {
						scoring += 0.15;
					}
				}

			}


		}
		scoring = Math.round((scoring + Number.EPSILON) * 100) / 100;
		return scoring;
	}
	// this function is a standart implementation of a minMax algorithm
	// with alpha beta pruning

	// minmax means that the ai looks at every response for every opponents
	// response to its own response ..... this goes on for the depth value

	// alpha beta pruning optimises the speed by limiting terrible lines
	// of possibilities
	// "why calculate possibilities when there is already a better chain of 
	// possibilities " -the Ai probably
	minMax(position, player, depth, alpha, beta) {

		this.stats++;

		if (depth == 0 || this.gameOver(position)) {
			let score = this.evaluate(position);
			return score;
		}

		if (player) {
			var maxEval = -Infinity;
			var positions = this.getPositions(position);
			for (let i = 0; i < positions.length; i++) {
				var ev = this.minMax(positions[i], false, depth - 1, alpha, beta);
				maxEval = Math.max(maxEval, ev);
				alpha = Math.max(alpha, maxEval);
				if (beta <= alpha) {
					break;
				}
			}
			return maxEval;

		} else {
			var minEval = Infinity;
			var positions = this.getPositions(position);
			for (let i = 0; i < positions.length; i++) {
				var ev = this.minMax(positions[i], true, depth - 1, alpha, beta);
				minEval = Math.min(minEval, ev);
				beta = Math.min(beta, minEval);
				if (beta <= alpha) {
					break;
				}
			}
			return minEval;
		}

	}

	// this function returns the possible positions
	// for the current root/input position
	getPositions(position) {
		var turn = position.turn;
		var positions = [];

		let possibleMovess = allMovesPossible(turn, position);

		for (let i = 0; i < possibleMovess.length; i++) {
			positions.push(_.cloneDeep(position));
			positions[i].prevMove = (_.cloneDeep(positions[i].prevMove));
		}

		for (let i = 0; i < possibleMovess.length; i++) {
			let current = positions[i];
			this.updatePosboard(current, possibleMovess[i]);
		}

		return positions;

		// this function compiles all of the possible moves
		// for all of the player's pieces
		function allMovesPossible(side, position) {
			var wcs = position.wcs;
			var bcs = position.bcs;

			var allMoves = [];

			if (side) {
				for (let i = 0; i < wcs.length; i++) {

					var moves = possibleMoves(wcs[i], position);

					if (!wcs[i].dead && moves.length != 0) {
						for (let i = 0; i < moves.length; i++) {
							allMoves.push(moves[i]);
						}
					}
				}
			} else {
				for (let i = 0; i < bcs.length; i++) {

					var moves = possibleMoves(bcs[i], position);

					if (!bcs[i].dead && moves.length != 0) {
						for (let i = 0; i < moves.length; i++) {
							allMoves.push(moves[i]);
						}

					}
				}
			}

			return allMoves;
		}

		// this function compiles a list of all
		// the moves that a singular piece can do
		// in the given position
		function possibleMoves(piece, position) {
			var moves = [];
			var board = position.posBoard;
			var color = piece.color;
			var location = piece.location;
			var x = location[0];
			var y = location[1];
			var king = piece.king;

			// cursed code, I know   :)
			// basically goes through every move
			// a piece can make and only adds it to
			// the posibilities if its legal in the current scenario
			if (color === "W" || king) {

				if (x - 2 > -1 && y - 2 > -1 && board[y - 2][x - 2] == null && board[y - 2][x - 2] == null && board[(y + (y - 2)) / 2][(x + (x - 2)) / 2] != null && board[(y + (y - 2)) / 2][(x + (x - 2)) / 2].color != piece.color) {
					moves.push(new Move(piece, [x - 2, y - 2], true));
				} else if (x - 1 > -1 && y - 1 > -1 && board[y - 1][x - 1] == null) {
					moves.push(new Move(piece, [x - 1, y - 1], false));
				}

				if (x + 2 < 8 && y - 2 > -1 && board[y - 2][x + 2] == null && board[y - 2][x + 2] == null && board[(y + (y - 2)) / 2][(x + (x + 2)) / 2] != null && board[(y + (y - 2)) / 2][(x + (x + 2)) / 2].color != piece.color) {
					moves.push(new Move(piece, [x + 2, y - 2], true));
				} else if (x + 1 < 8 && y - 1 > -1 && board[y - 1][x + 1] == null) {
					moves.push(new Move(piece, [x + 1, y - 1], false));
				}

			}

			if (color === "B" || king) {

				if (x + 2 < 8 && y + 2 < 8 && board[y + 2][x + 2] == null && board[y + 2][x + 2] == null && board[(y + (y + 2)) / 2][(x + (x + 2)) / 2] != null && board[(y + (y + 2)) / 2][(x + (x + 2)) / 2].color != piece.color) {
					moves.push(new Move(piece, [x + 2, y + 2], true));
				} else if (x + 1 < 8 && y + 1 < 8 && board[y + 1][x + 1] == null) {
					moves.push(new Move(piece, [x + 1, y + 1], false));
				}

				if (x - 2 > -1 && y + 2 < 8 && board[y + 2][x - 2] == null && board[y + 2][x - 2] == null && board[(y + (y + 2)) / 2][(x + (x - 2)) / 2] != null && board[(y + (y + 2)) / 2][(x + (x - 2)) / 2].color != piece.color) {
					moves.push(new Move(piece, [x - 2, y + 2], true));
				} else if (x - 1 > -1 && y + 1 < 8 && board[y + 1][x - 1] == null) {
					moves.push(new Move(piece, [x - 1, y + 1], false));
				}
			}

			return moves;
		}

	}

}

export { AI }