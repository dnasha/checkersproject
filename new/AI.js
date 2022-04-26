import {Move} from "./move.js";

class AI {
	
	constructor(currentPos) {
		this.position = currentPos;
		this.stats = 0;
	}
	
	getMove() {
		console.log(this.position.toString());
		var start = Date.now();
		
		var score = [-Infinity, this.position]; 
		
		var positions = this.getPositions(this.position);

		//var npos = this.position.copy();

		//console.log("Original \n" + this.position.toString() + "\n");
		
		//console.log("Copy \n" + npos.toString());

		//depth = input + 1
		
		for (let i = 0; i < positions.length; i ++) {
			var temp = this.minMax(positions[i], true, 3, -Infinity, Infinity);
			//var temp = this.evaluate(positions[i]);
			
			//console.log(temp);
			
			if (temp > score[0]) {
				score[0] = temp;
				score[1] = positions[i];
			}
			
		}
		
		
		//console.log("passed2");
		
		var stats = this.stats;
		
		//var pick = Math.floor(Math.random() * positions.length);
		
		console.log("Positions Calculated: " + stats);
		console.log("Time taken (s): " + (Date.now() - start)/1000);
		
		//score[1] = positions[pick];
		
		let best = score[1];
		
		let piece = best.prevMove.piece;
		let type = best.prevMove.type;
		let cords = best.prevMove.cords;
		let optimalMove = new Move(piece, cords, type);
		
		//for (let i = 0; i < positions.length; i ++) {
		//	console.log(positions[i].toString());
		//}
		
		return optimalMove;
	}
	
	update(newPos) {
		this.position = newPos;
		this.stats = 0;
	}

	updatePosboard(position, move) {

		var board = position.posBoard;
		var piece = move.piece;
		var cords = move.cords;
		var type = move.type;
		var px = piece.location[0];
		var py = piece.location[1];
		var mx = cords[0];
		var my = cords[1];
		
		
		board[py][px] = null;
		
		board[my][mx] = piece;
		
		if (type) {
			board[(py + my) / 2][(px + mx) / 2].dead = true;
			board[(py + my) / 2][(px + mx) / 2] = null;
		} 

		piece.cords = cords;
	}
	
	evaluate(position) {
		var wcc = position.wcc;
		var bcc = position.bcc;
		var wkc = position.wkc;
		var bkc = position.bkc;
		
		/*
		if (position.gameOver()) {
			if (position.turn) {
				return 1000;
			} else {
				return -1000;
			}
		}
		*/
		
		return bcc - wcc + (2 * (bkc - wkc));
	}
	
	minMax(position, player, depth, alpha, beta) {

		this.stats ++;
		
		if (depth == 0 /*|| position.gameOver*/) {
			return this.evaluate(position);
		}
	
		if (player) {
			var maxEval = -Infinity;
			var positions = this.getPositions(position);
			for (let i = 0; i < positions.length; i ++ ) {
				var ev = this.minMax(positions[i], false, depth - 1, alpha, beta);
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

	getPositions(position) {
		var turn = position.turn;
		var positions = [];
		
		var possibleMoves = allMovesPossible(turn);

		
		for (let i = 0; i < possibleMoves.length; i++) {
			//console.log("passed0.1");

			positions.push(position.copy());
			
			//console.log("passed0.2");
			
			var current = positions[i];
			
			//console.log("passed0.3");
			
			current.prevMove = possibleMoves[i];
			this.updatePosboard(current, possibleMoves[i]);
		
			//console.log(possibleMoves[i]);
		}

		
		
		return positions;
			 
		function allMovesPossible(side) {
			var wcs = position.wcs;
			var bcs = position.bcs;
			
			let prevTurn = turn;
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
				if (x+1 < 8 && y+1 < 8 && board[y-1][x+1] == null) {
					moves.push(new Move(piece, [x+1, y-1], false));
				}

				if (x-1 > -1 && y+1 < 8 && board[y-1][x-1] == null) {
					moves.push(new Move(piece, [x-1, y-1], false));
				}

				if (x+2 < 8 && y+2 < 8 && board[y-2][x-2] == null && board[y-2][x-2] != null && board[y-2][x-2].color != piece.color) {
					moves.push(new Move(piece, [x-2, y-2], false));
				}

				if (x-2 > -1 && y+2 < 8 && board[y-2][x+2] == null && board[y-2][x+2] != null && board[y-2][x+2].color != piece.color) {
					moves.push(new Move(piece, [x+2, y-2], false));
				}
				
			}
			
			if (color === "B" || king) {
				if (x+1 < 8 && y+1 < 8 && board[y+1][x+1] == null) {
					moves.push(new Move(piece, [x+1, y+1], false));
				}

				if (x-1 > -1 && y+1 < 8 && board[y+1][x-1] == null) {
					moves.push(new Move(piece, [x-1, y+1], false));
				}

				if (x+2 < 8 && y+2 < 8 && board[y+2][x+2] == null && board[y+2][x+2] != null && board[y+2][x+2].color != piece.color) {
					moves.push(new Move(piece, [x+2, y+2], false));
				}

				if (x-2 > -1 && y+2 < 8 && board[y+2][x-2] == null && board[y+2][x-2] != null && board[y+2][x-2].color != piece.color) {
					moves.push(new Move(piece, [x-2, y+2], false));
				}
			}
			
			return moves;
		}
		
	}

	

	
}

export {AI}