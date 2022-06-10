import {Move} from "./move.js";

class AI {
	
	constructor(currentPos) {
		this.position = currentPos;
		this.stats = 0;
	}
	
	getMove() {
		//console.log(this.position.toString());
		var start = Date.now();
		
		var score = [-Infinity, this.position]; 
		
		var positions = this.getPositions(this.position);

		//for (let i = 0; i < positions.length; i ++) {
			//console.log(positions[i].toString());
		//}
		
		// var position1 = this.position;
		// var position2 = this.position.copy();

		// console.log(position1.prevMove);
		// console.log(position2.prevMove);
		// position1.prevMove = null;
		// console.log(position1.prevMove);
		// console.log(position2.prevMove);
		
		//var npos = this.position.copy();

		//console.log("Original \n" + this.position.toString() + "\n");
		
		//console.log("Copy \n" + npos.toString());

		//depth = input + 1
		
		for (let i = 0; i < positions.length; i ++) {
			var temp = this.minMax(positions[i], true, 5, -Infinity, Infinity);
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

		let board = position.posBoard;
		let piece = move.piece;
		let cords = move.cords;
		let type = move.type;
		let px = piece.location[0];
		let py = piece.location[1];
		let mx = cords[0];
		let my = cords[1];
		
		
		//position.turn = !position.turn;
		
		if (piece.color === "B") {
			position.turn = true;
			if (!piece.king && my == 7) {
				piece.king = true;
				position.bkc ++;
			}
		} else {
			position.turn = false;
			if (!piece.king && my == 0) {
				piece.king = true;
				position.wkc ++;
			}
		}
		
		if (type) {
			 //console.log(position.toString());
			 //console.log(position.prevMove.toString());
			 //console.log(px + " " + py);
			 //console.log(mx + " " + my);
			 //console.log(board[(py + my) / 2][(px + mx) / 2]);
			if (board[(py + my) / 2][(px + mx) / 2].color === "W") {
				position.wcc --;

				if (board[(py + my) / 2][(px + mx) / 2].king) {
					position.wkc --;
				}
			} else {
				position.bcc --;

				if (board[(py + my) / 2][(px + mx) / 2].king) {
					position.bkc --;
				}
			}
		
			board[(py + my) / 2][(px + mx) / 2].dead = true;
			board[(py + my) / 2][(px + mx) / 2] = null;
		}
		
		board[my][mx] = piece;
		board[py][px] = null;
		
		// setTimeout(function()
  //   	{
  //       display(position);
  //   	}, 1000);
		
		// function display(position) {
		// 	var wcs = position.wcs;
		// 	var bcs = position.bcs;
	
		// 	for (let i = 0; i < bcs.length; i ++) {
		// 		var newCords = bcs[i].location;
		// 		var piece = bcs[i];
		// 		var newX = newCords[0];
		// 		var newY = newCords[1];
		// 		piece.source.style.left = (newX * 80) + "px";
		// 		piece.source.style.top = (newY * 80) + "px";
				
		// 	}
		// 	for (let i = 0; i < wcs.length; i ++) {
		// 		var newCords = wcs[i].location;
		// 		var piece = wcs[i];
		// 		var newX = newCords[0];
		// 		var newY = newCords[1];
		// 		piece.source.style.left = (newX * 80) + "px";
		// 		piece.source.style.top = (newY * 80) + "px";
				
		// 	}
		
		// }
		
		// setTimeout(function()
  //   	{
  //       display(this.position);
  //   	}, 3000);
		position.turn = !position.turn;
		//piece.location[0] = cords[0];
		//piece.location[1] = cords[1];
		px = mx;
		py = my;
	}
	
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
		
		
		return bcc - wcc + (2 * (bkc - wkc));
	}
	
	minMax(position, player, depth, alpha, beta) {
		//console.log(player);
		this.stats ++;
		
		if (depth == 0 || position.gameOver()) {
			let score = this.evaluate(position);
			//console.log(position.toString());
			return score;
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
		
		//console.log(turn);
		
		var positions = [];
		
		let possibleMovess = allMovesPossible(turn, position);

		//console.log(possibleMovess[4].toString());
		
		for (let i = 0; i < possibleMovess.length; i++) {
			//console.log("passed0.1");
			//console.log(possibleMovess[i].toString());
			positions.push(position.copy());
			
			//console.log("passed0.2");
			
			let current = positions[i];
			
			//console.log("passed0.3");
			
			current.prevMove = possibleMovess[i];
		
			//console.log("**********************************");
			//console.log(current.toString());
			//console.log(possibleMoves[i].toString());
			this.updatePosboard(current, possibleMovess[i]);
			//console.log(current.toString());
			
		}

		//console.log("******************************************");
		
		return positions;
			 
		function allMovesPossible(side, position) {
			var wcs = position.wcs;
			var bcs = position.bcs;
			
			var allMoves = [];
			
			if (side) {
				for (let i = 0; i < wcs.length; i ++) {
					if (!wcs[i].dead && !possibleMoves(wcs[i]).length == 0) {
						var moves = possibleMoves(wcs[i]);
						
						for (let i = 0; i < moves.length; i ++) {
							allMoves.push(moves[i]);
						}
					}
				}
			} else {
				for (let i = 0; i < bcs.length; i ++) {
					if (!bcs[i].dead && !possibleMoves(bcs[i]).length == 0) {
						var moves = possibleMoves(bcs[i]);
						
						for (let i = 0; i < moves.length; i ++) {
							allMoves.push(moves[i]);
						}
						
					}
				}
			}
	
			//console.log(allMoves.length);
			
			// 	for (var j = 0; j < allMoves.length; j ++) {
			 //		console.log(allMoves[j].toString());
			 //	}
			
			//console.log(allMoves[4].toString());
			
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
				if (x+1 < 8 && y-1 > -1 && board[y-1][x+1] == null) {
					moves.push(new Move(piece, [x+1, y-1], false));
				}

				if (x-1 > -1 && y-1 > -1 && board[y-1][x-1] == null) {
					moves.push(new Move(piece, [x-1, y-1], false));
				}

				if (x-2 > -1 && y-2 > -1 && board[y-2][x-2] == null && board[y-2][x-2] == null && board[(y + (y-2))/2][(x + (x-2))/2] != null && board[(y + (y-2))/2][(x + (x-2))/2].color != piece.color) {
					moves.push(new Move(piece, [x-2, y-2], true));
				}

				if (x+2 < 8 && y-2 > -1 && board[y-2][x+2] == null && board[y-2][x+2] == null && board[(y + (y-2))/2][(x + (x+2))/2] != null && board[(y + (y-2))/2][(x + (x+2))/2].color != piece.color) {
					moves.push(new Move(piece, [x+2, y-2], true));
				}
				
			}
			
			if (color === "B" || king) {
				if (x+1 < 8 && y+1 < 8 && board[y+1][x+1] == null) {
					moves.push(new Move(piece, [x+1, y+1], false));
				}

				if (x-1 > -1 && y+1 < 8 && board[y+1][x-1] == null) {
					moves.push(new Move(piece, [x-1, y+1], false));
				}

				if (x+2 < 8 && y+2 < 8 && board[y+2][x+2] == null && board[y+2][x+2] == null && board[(y + (y+2))/2][(x + (x+2))/2] != null && board[(y + (y+2))/2][(x + (x+2))/2].color != piece.color) {
					moves.push(new Move(piece, [x+2, y+2], true));
				}

				if (x-2 > -1 && y+2 < 8 && board[y+2][x-2] == null && board[y+2][x-2] == null && board[(y + (y+2))/2][(x + (x-2))/2] != null && board[(y + (y+2))/2][(x + (x-2))/2].color != piece.color) {
					moves.push(new Move(piece, [x-2, y+2], true));
				}
			}
			
			//console.log(moves.length);
			 for (let i = 0; i < moves.length; i ++) {
			 	//console.log(moves[i].toString()); 
			 }
			return moves;
		}
		
	}

	

	
}

export {AI}