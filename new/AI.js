import {Move} from "./move.js";

class AI {
	
	constructor(currentPos) {
		this.position = currentPos;
	}
	
	getMove() {
		/*
		score = [-Infinity, this.position]; 
		positions = getPositions(this.position);

		for (let i = 0; i < positions.length; i ++) {
			var temp = minMax(positions[i], true, 2, -Infinity, Infinity);

			if (temp > score[0]) {
				score[0] = temp;
				score[1] = positions[i];
			}
			
		}
		var best = score[1];
		*/
		var piece = this.position.bcs[9];
		var type = false;
		var cords = [4, 3];
		var optimalMove = new Move(piece, cords, type);

		return optimalMove;
	}
	
	update(newPos) {
		this.position = newPos;
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
	
		if (depth == 0 || state.gameOver) {
			return evaluate(state);
		}
	
		if (player) {
			var maxEval = -Infinity;
			var positions = getPositions(state);
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
			var positions = getPositions(state);
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
		
	}
}

export {AI}