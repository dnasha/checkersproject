import {Move} from "./move.js";

class AI {
	
	constructor(currentPos) {
		this.position = currentPos;
		this.stats = 0;
	}
	
	getMove() {
		
		var start = Date.now();
		
		//var score = [-Infinity, this.position]; 
		var positions = this.getPositions(this.position);

		/*
		for (let i = 0; i < positions.length; i ++) {
			var temp = minMax(positions[i], true, 2, -Infinity, Infinity);

			if (temp > score[0]) {
				score[0] = temp;
				score[1] = positions[i];
			}
			
		}
		*/
		var stats = this.stats;
		
		console.log("Positions Calculated: " + stats);
		console.log("Time taken (s): " + (Date.now() - start)/1000);
		
		//var best = score[1].lastMove;
		
		//var piece = best.lastMove.piece;
		//var type = best.lastMove.type;
		//var cords = best.lastMove.cords;
		//var optimalMove = new Move(piece, cords, type);

		//return optimalMove;

		for (let i = 0; i < positions.length; i ++) {
			console.log(positions[i].toString);
		}
	}
	
	update(newPos) {
		this.position = newPos;
		this.stats = 0;
	}
	
	evaluate(position) {
		var wpc = position.wpc;
		var bpc = position.bpc;
		var wkc = position.wkc;
		var bkc = position.bkc;
	
		if (position.gameOver) {
			if (position.turn) {
				return 1000;
			} else {
				return -1000;
			}
		}
		
		return bpc - wpc + (bkc - wkc);
	}
	
	minMax(position, player, depth, alpha, beta) {
	
		if (depth == 0 || position.gameOver) {
			return evaluate(position);
		}
	
		if (player) {
			var maxEval = -Infinity;
			var positions = this.getPositions(position);
			for (let i = 0; i < positions.length; i ++ ) {
				var ev = minMax(positions[i], player, depth - 1, alpha, beta);
				maxEval = Math.max(maxEval, ev);
				alpha = Math.max(alpha, ev);
				if (beta <= alpha) {
					break;
				}
			}
			return maxEval;
	
		} else {
			var minEval = Infinity;
			var positions = this.getPositions(position);
			for (let i = 0; i < positions.length; i ++ ) {
				var ev = minMax(positions[i], player, depth - 1, alpha, beta);
				minEval = Math.min(minEval, ev);
				beta = Math.min(beta, ev);
				if (beta <= alpha) {
					break;
				}
			}
			return minEval;
		}
	
	}

	getPositions(position) {
		var turn = position.turn;
		var stats = this.stats;
		
		function allMovesPossible(side) {
			var wcs = position.wcs;
			var bcs = position.bcs;
			
			var prevTurn = turn;
			var allMoves = [];
			
			if (side) {
				turn = true;
				for (let i = 0; i < wcs.length; i ++) {
					if (wcs[i].source.style.visibility === "visible" && !possibleMoves(wcs[i]).length == 0) {
						var moves = possibleMoves(wcs[i]);
						
						for (let i = 0; i < moves.length; i ++) {
							allMoves.push(moves[i]);
						}
					}
				}
			} else {
				turn = false;
				for (let i = 0; i < bcs.length; i ++) {
					if (bcs[i].source.style.visibility === "visible" && !possibleMoves(bcs[i]).length == 0) {
						var moves = possibleMoves(bcs[i]);

						for (let i = 0; i < moves.length; i ++) {
							allMoves.push(moves[i]);
						}
						
					}
				}
			}
	
			/*
			for (var i = 0; i < allMoves.length; i ++) {
				for (var j = 0; j < allMoves[i].length; j ++) {
					console.log(allMoves[i][j].toString());
				}
			}
			*/
			
			stats += allMoves.length;
			
			turn = prevTurn;
	
			return allMoves;
		}
		
		function possibleMoves(piece) {
			var moves = [];

			var board = position.posBoard;
			var color = piece.color;
			var location = piece.location;
			var x = location[0];
			var y = location[1];
			var king = piece.king;

			if (color === "W" || king) {
				if (x+1 < 8 && y+1 < 8 && board[y+1][x+1] == null) {
					moves.push(new Move(piece, [x+1, y+1], false));
				}

				if (x-1 > -1 && y+1 < 8 && board[y+1][x-1] == null) {
					moves.push(new Move(piece, [x-1, y+1], false));
				}

				if (x+2 < 8 && y+2 < 8 && board[y+2][x+2] == null && board[y+1][x+1] != null && board[y+1][x+1].color != piece.color) {
					moves.push(new Move(piece, [x+1, y+1], false));
				}

				if (x-2 > -1 && y+2 < 8 && board[y+2][x-2] == null && board[y+1][x+1] != null && board[y+1][x-1].color != piece.color) {
					moves.push(new Move(piece, [x-1, y+1], false));
				}
				
			}
			
			if (color === "B" || king) {
				if (x+1 < 8 && y+1 < 8 && board[y+1][x+1] == null) {
					moves.push(new Move(piece, [x+1, y+1], false));
				}

				if (x-1 > -1 && y+1 < 8 && board[y+1][x-1] == null) {
					moves.push(new Move(piece, [x-1, y+1], false));
				}

				if (x+2 < 8 && y+2 < 8 && board[y+2][x+2] == null && board[y+1][x+1] != null && board[y+1][x+1].color != piece.color) {
					moves.push(new Move(piece, [x+1, y+1], false));
				}

				if (x-2 > -1 && y+2 < 8 && board[y+2][x-2] == null && board[y+1][x+1] != null && board[y+1][x-1].color != piece.color) {
					moves.push(new Move(piece, [x-1, y+1], false));
				}
			}

			if (x+1 != 8 && y+1 != 8 && board[y+1][x+1] == null) {
				moves.push(new Move(piece, [x+1, y+1], false));
			}
			

			return moves;
		}
		
		var possibleMoves = allMovesPossible();
		
	}

	

	
}

export {AI}