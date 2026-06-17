import { Move } from "./move.js";

// The AI class is responsible for playing against the player when enabled
// It uses the MiniMax algorithm and an evaluation heuristic to account
// for several moves in the future and determine the best move to make in the
// present
class AI {
	constructor(currentPos) {
		this.position = currentPos;
		this.stats = 0;
	}

	// main function that reaches out to the helper methods
	// to generate the move that the AI wants to make
	getMove() {
		var start = Date.now();

		var score = [Number.NEGATIVE_INFINITY, this.position];

		var positions = this.getPositions(this.position);

		// going through posible initial branches
		// of outcomes to grade them and pick
		// the best one
		for (let i = 0; i < positions.length; i++) {
			var temp = this.minMax(
				positions[i],
				false,
				4,
				Number.NEGATIVE_INFINITY,
				Number.POSITIVE_INFINITY,
			);

			if (temp > score[0]) {
				score[0] = temp;
				score[1] = positions[i];
			}
		}

		var stats = this.stats;

		console.log("Positions Calculated: " + stats);
		console.log("Time taken (s): " + (Date.now() - start) / 1000);

		const best = score[1];

		const piece = best.prevMove.piece;
		const type = best.prevMove.type;
		const cords = best.prevMove.cords;
		const optimalMove = new Move(piece, cords, type);

		return optimalMove;
	}

	// refreshes the current fields within the class
	update(newPos) {
		this.position = newPos;
		this.stats = 0;
	}

	// this function takes a position and
	// applies a move to it to help the
	// algorithm see the outcome of that move
	updatePosboard(position, move) {
		const board = position.posBoard;
		const cords = move.cords;
		const type = move.type;
		const oldPiece = move.piece;
		const px = oldPiece.location[0];
		const py = oldPiece.location[1];
		const mx = cords[0];
		const my = cords[1];
		const piece = board[py][px];
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
			var attacked =
				board[Math.round((py + my) / 2)][Math.round((px + mx) / 2)];
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

	// this function grades how good a move is
	// for the ai
	// the higher the score, the better the move
	evaluate(position) {
		var wcc = position.wcc;
		var bcc = position.bcc;
		var wkc = position.wkc;
		var bkc = position.bkc;

		if (position.gameOver()) {
			if (position.turn) {
				return 1000;
			} else {
				return -1000;
			}
		}

		const score = bcc - wcc + 2 * (bkc - wkc);

		return score;
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

		if (depth == 0 || position.gameOver()) {
			const score = this.evaluate(position);
			return score;
		}

		if (player) {
			var maxEval = Number.NEGATIVE_INFINITY;
			var positions = this.getPositions(position);
			for (let i = 0; i < positions.length; i++) {
				var ev = this.minMax(positions[i], false, depth - 1, alpha, beta);
				maxEval = Math.max(maxEval, ev);
				alpha = Math.max(alpha, ev);
				if (beta <= alpha) {
					break;
				}
			}
			return maxEval;
		} else {
			var minEval = Number.POSITIVE_INFINITY;
			var positions = this.getPositions(position);
			for (let i = 0; i < positions.length; i++) {
				var ev = this.minMax(positions[i], true, depth - 1, alpha, beta);
				minEval = Math.min(minEval, ev);
				beta = Math.min(beta, ev);
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

		const possibleMovess = allMovesPossible(turn, position);

		for (let i = 0; i < possibleMovess.length; i++) {
			positions.push(_.cloneDeep(position));
			positions[i].prevMove = _.cloneDeep(positions[i].prevMove);
		}

		for (let i = 0; i < possibleMovess.length; i++) {
			const current = positions[i];
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

			if (document.getElementById("forcedLaw")?.checked) {
				var attackMoves = allMoves.filter((m) => m.type);
				if (attackMoves.length > 0) {
					return attackMoves;
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
				if (x + 1 < 8 && y - 1 > -1 && board[y - 1][x + 1] == null) {
					moves.push(new Move(piece, [x + 1, y - 1], false));
				}

				if (x - 1 > -1 && y - 1 > -1 && board[y - 1][x - 1] == null) {
					moves.push(new Move(piece, [x - 1, y - 1], false));
				}

				if (
					x - 2 > -1 &&
					y - 2 > -1 &&
					board[y - 2][x - 2] == null &&
					board[y - 2][x - 2] == null &&
					board[(y + (y - 2)) / 2][(x + (x - 2)) / 2] != null &&
					board[(y + (y - 2)) / 2][(x + (x - 2)) / 2].color != piece.color
				) {
					moves.push(new Move(piece, [x - 2, y - 2], true));
				}

				if (
					x + 2 < 8 &&
					y - 2 > -1 &&
					board[y - 2][x + 2] == null &&
					board[y - 2][x + 2] == null &&
					board[(y + (y - 2)) / 2][(x + (x + 2)) / 2] != null &&
					board[(y + (y - 2)) / 2][(x + (x + 2)) / 2].color != piece.color
				) {
					moves.push(new Move(piece, [x + 2, y - 2], true));
				}
			}

			if (color === "B" || king) {
				if (x + 1 < 8 && y + 1 < 8 && board[y + 1][x + 1] == null) {
					moves.push(new Move(piece, [x + 1, y + 1], false));
				}

				if (x - 1 > -1 && y + 1 < 8 && board[y + 1][x - 1] == null) {
					moves.push(new Move(piece, [x - 1, y + 1], false));
				}

				if (
					x + 2 < 8 &&
					y + 2 < 8 &&
					board[y + 2][x + 2] == null &&
					board[y + 2][x + 2] == null &&
					board[(y + (y + 2)) / 2][(x + (x + 2)) / 2] != null &&
					board[(y + (y + 2)) / 2][(x + (x + 2)) / 2].color != piece.color
				) {
					moves.push(new Move(piece, [x + 2, y + 2], true));
				}

				if (
					x - 2 > -1 &&
					y + 2 < 8 &&
					board[y + 2][x - 2] == null &&
					board[y + 2][x - 2] == null &&
					board[(y + (y + 2)) / 2][(x + (x - 2)) / 2] != null &&
					board[(y + (y + 2)) / 2][(x + (x - 2)) / 2].color != piece.color
				) {
					moves.push(new Move(piece, [x - 2, y + 2], true));
				}
			}

			return moves;
		}
	}
}

export { AI };
