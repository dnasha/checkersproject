import {Move} from "./move.js";

// Lightweight state representation for the AI minimax search tree
class SearchState {
	constructor(wcs, bcs, board, turn, prevMove) {
		this.wcs = wcs; // [[x, y, king, dead], ...]
		this.bcs = bcs; // [[x, y, king, dead], ...]
		this.board = board; // 8x8 grid where cells are null or { side: 'W'|'B', index: number }
		this.turn = turn; // boolean (true = white, false = black)
		this.prevMove = prevMove; // { side: 'W'|'B', index: number, cords: [x,y], type: boolean }
	}
}

// Converts a heavy Position object to a lightweight SearchState
function toSearchState(position) {
	const wcs = position.wcs.map(p => [p.location[0], p.location[1], p.king, p.dead]);
	const bcs = position.bcs.map(p => [p.location[0], p.location[1], p.king, p.dead]);
	
	const board = [];
	for (let y = 0; y < 8; y++) {
		board.push([]);
		for (let x = 0; x < 8; x++) {
			const p = position.posBoard[y][x];
			if (p === null) {
				board[y].push(null);
			} else {
				board[y].push({ side: p.color, index: p.index });
			}
		}
	}
	
	let prevMove = null;
	if (position.prevMove) {
		prevMove = {
			side: position.prevMove.piece.color,
			index: position.prevMove.piece.index,
			cords: [position.prevMove.cords[0], position.prevMove.cords[1]],
			type: position.prevMove.type
		};
	}
	
	return new SearchState(wcs, bcs, board, position.turn, prevMove);
}

// Deep clones the lightweight SearchState object in microseconds
function cloneSearchState(state) {
	const wcs = state.wcs.map(p => [p[0], p[1], p[2], p[3]]);
	const bcs = state.bcs.map(p => [p[0], p[1], p[2], p[3]]);
	
	const board = [];
	for (let y = 0; y < 8; y++) {
		board.push([]);
		for (let x = 0; x < 8; x++) {
			const cell = state.board[y][x];
			if (cell === null) {
				board[y].push(null);
			} else {
				board[y].push({ side: cell.side, index: cell.index });
			}
		}
	}
	
	let prevMove = null;
	if (state.prevMove) {
		prevMove = {
			side: state.prevMove.side,
			index: state.prevMove.index,
			cords: [state.prevMove.cords[0], state.prevMove.cords[1]],
			type: state.prevMove.type
		};
	}
	
	return new SearchState(wcs, bcs, board, state.turn, prevMove);
}

// High-speed move generation for a single piece
function possibleMoves(side, index, state) {
	const piece = (side === 'W') ? state.wcs[index] : state.bcs[index];
	if (piece[3]) return []; // dead
	
	const x = piece[0];
	const y = piece[1];
	const king = piece[2];
	const moves = [];
	const board = state.board;
	
	// Diagonals going up (y-1) - White pieces move up
	if (side === 'W' || king) {
		// Up-Right
		if (x + 1 < 8 && y - 1 > -1) {
			if (board[y - 1][x + 1] === null) {
				moves.push({ side, index, cords: [x + 1, y - 1], type: false });
			}
		}
		// Up-Left
		if (x - 1 > -1 && y - 1 > -1) {
			if (board[y - 1][x - 1] === null) {
				moves.push({ side, index, cords: [x - 1, y - 1], type: false });
			}
		}
		// Jump Up-Right
		if (x + 2 < 8 && y - 2 > -1) {
			const mid = board[y - 1][x + 1];
			if (mid !== null && mid.side !== side && board[y - 2][x + 2] === null) {
				moves.push({ side, index, cords: [x + 2, y - 2], type: true });
			}
		}
		// Jump Up-Left
		if (x - 2 > -1 && y - 2 > -1) {
			const mid = board[y - 1][x - 1];
			if (mid !== null && mid.side !== side && board[y - 2][x - 2] === null) {
				moves.push({ side, index, cords: [x - 2, y - 2], type: true });
			}
		}
	}
	
	// Diagonals going down (y+1) - Black pieces move down
	if (side === 'B' || king) {
		// Down-Right
		if (x + 1 < 8 && y + 1 < 8) {
			if (board[y + 1][x + 1] === null) {
				moves.push({ side, index, cords: [x + 1, y + 1], type: false });
			}
		}
		// Down-Left
		if (x - 1 > -1 && y + 1 < 8) {
			if (board[y + 1][x - 1] === null) {
				moves.push({ side, index, cords: [x - 1, y + 1], type: false });
			}
		}
		// Jump Down-Right
		if (x + 2 < 8 && y + 2 < 8) {
			const mid = board[y + 1][x + 1];
			if (mid !== null && mid.side !== side && board[y + 2][x + 2] === null) {
				moves.push({ side, index, cords: [x + 2, y + 2], type: true });
			}
		}
		// Jump Down-Left
		if (x - 2 > -1 && y + 2 < 8) {
			const mid = board[y + 1][x - 1];
			if (mid !== null && mid.side !== side && board[y + 2][x - 2] === null) {
				moves.push({ side, index, cords: [x - 2, y + 2], type: true });
			}
		}
	}
	
	return moves;
}

// Compiles all legal moves for a side, respecting forced capture rules
function allMovesPossible(side, state) {
	const sideChar = side ? 'W' : 'B';
	const allMoves = [];
	for (let i = 0; i < 12; i++) {
		const moves = possibleMoves(sideChar, i, state);
		for (let j = 0; j < moves.length; j++) {
			allMoves.push(moves[j]);
		}
	}
	
	if (document.getElementById("forcedLaw")?.checked) {
		const attackMoves = allMoves.filter(m => m.type);
		if (attackMoves.length > 0) {
			return attackMoves;
		}
	}
	
	return allMoves;
}

// The AI class is responsible for playing against the player when enabled
// It uses the MiniMax algorithm and an evaluation heuristic to account
// for several moves in the future and determine the best move to make in the
// present
class AI {
	
	constructor(currentPos) {
		this.position = currentPos;
		this.stats = 0;
		this.lastEval = 0;
		this.lastTime = 0;
	}

	// main function that reaches out to the helper methods
	// to generate the move that the AI wants to make
	getMove() {	
		const start = Date.now();
		this.stats = 0;
		
		const state = toSearchState(this.position);
		const score = [-Infinity, null]; 
		
		const positions = this.getPositions(state);

		// going through possible initial branches
		// of outcomes to grade them and pick
		// the best one
		for (let i = 0; i < positions.length; i ++) {
			const temp = this.minMax(positions[i], false, 6, -Infinity, Infinity);
			
			if (temp > score[0]) {
				score[0] = temp;
				score[1] = positions[i];
			}
		}
				
		const stats = this.stats;
		this.lastEval = score[0];
		this.lastTime = (Date.now() - start) / 1000;
		
		console.log("Positions Calculated: " + stats);
		console.log("Time taken (s): " + this.lastTime);
		
		const bestState = score[1];
		if (!bestState) return null;
		
		const bestMove = bestState.prevMove;
		const originalPiece = (bestMove.side === 'W') ? this.position.wcs[bestMove.index] : this.position.bcs[bestMove.index];
		const optimalMove = new Move(originalPiece, bestMove.cords, bestMove.type);
				
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
	updateState(state, move) {
		const side = move.side;
		const index = move.index;
		const cords = move.cords;
		const type = move.type;
		
		const piece = (side === 'W') ? state.wcs[index] : state.bcs[index];
		const px = piece[0];
		const py = piece[1];
		const mx = cords[0];
		const my = cords[1];
		
		state.prevMove = move;
		
		// Update board grid and piece location
		state.board[py][px] = null;
		state.board[my][mx] = { side, index };
		piece[0] = mx;
		piece[1] = my;
		
		// Handle king promotion
		if (side === 'B') {
			state.turn = true;
			if (!piece[2] && my === 7) {
				piece[2] = true;
			}
		} else {
			state.turn = false;
			if (!piece[2] && my === 0) {
				piece[2] = true;
			}
		}
		
		// Handle capture
		if (type) {
			const ax = Math.round((px + mx) / 2);
			const ay = Math.round((py + my) / 2);
			const attacked = state.board[ay][ax];
			
			if (attacked !== null) {
				if (attacked.side === 'W') {
					state.wcs[attacked.index][3] = true; // dead = true
				} else {
					state.bcs[attacked.index][3] = true; // dead = true
				}
				state.board[ay][ax] = null;
			}
		}
	}

	// this function grades how good a move is for the ai
	// the higher the score, the better the move
	evaluate(state) {
		let wcc = 0;
		let bcc = 0;
		let wkc = 0;
		let bkc = 0;
		
		for (let i = 0; i < 12; i++) {
			const wp = state.wcs[i];
			if (!wp[3]) {
				wcc++;
				if (wp[2]) wkc++;
			}
			const bp = state.bcs[i];
			if (!bp[3]) {
				bcc++;
				if (bp[2]) bkc++;
			}
		}
		
		if (wcc === 0 || bcc === 0) {
			if (state.turn) {
				return 1000;
			} else {
				return -1000;
			}
		}

		const score = bcc - wcc + (2 * (bkc - wkc));
		return score;
	}

	// standard implementation of a minMax algorithm with alpha beta pruning
	minMax(state, player, depth, alpha, beta) {
		this.stats ++;
		
		const isGameOver = this.gameOver(state);
		
		if (depth === 0 || isGameOver) {
			const score = this.evaluate(state);
			return score;
		}
	
		if (player) {
			let maxEval = -Infinity;
			const positions = this.getPositions(state);
			for (let i = 0; i < positions.length; i ++ ) {
				const ev = this.minMax(positions[i], false, depth - 1, alpha, beta);
				maxEval = Math.max(maxEval, ev);
				alpha = Math.max(alpha, ev);
				if (beta <= alpha) {
					break;
				}
			}
			return maxEval;
	
		} else {
			let minEval = Infinity;
			const positions = this.getPositions(state);
			for (let i = 0; i < positions.length; i ++ ) {
				const ev = this.minMax(positions[i], true, depth - 1, alpha, beta);
				minEval = Math.min(minEval, ev);
				beta = Math.min(beta, ev);
				if (beta <= alpha) {
					break;
				}
			}
			return minEval;
		}
	}

	// returns the possible child positions for a given state
	getPositions(state) {
		const positions = [];
		const possibleMovess = allMovesPossible(state.turn, state);
		
		for (let i = 0; i < possibleMovess.length; i++) {
			const nextState = cloneSearchState(state);
			this.updateState(nextState, possibleMovess[i]);
			positions.push(nextState);
		}
		
		return positions;
	}
	
	// Helper method to check if game is over (no pieces left for either player)
	gameOver(state) {
		let wcc = 0;
		let bcc = 0;
		for (let i = 0; i < 12; i++) {
			if (!state.wcs[i][3]) wcc++;
			if (!state.bcs[i][3]) bcc++;
		}
		return wcc === 0 || bcc === 0;
	}
}

export {AI}
