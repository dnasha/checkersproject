import {Move} from "./move.js";

// Lightweight state representation for the AI minimax search tree
class SearchState {
	constructor(wcs, bcs, board, turn, prevMove, lockedPieceIndex = null) {
		this.wcs = wcs; // [[x, y, king, dead], ...]
		this.bcs = bcs; // [[x, y, king, dead], ...]
		this.board = board; // 8x8 grid where cells are null or { side: 'W'|'B', index: number }
		this.turn = turn; // boolean (true = white, false = black)
		this.prevMove = prevMove; // { side: 'W'|'B', index: number, cords: [x,y], type: boolean }
		this.lockedPieceIndex = lockedPieceIndex; // index of the piece forced to double jump, or null
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
	
	return new SearchState(wcs, bcs, board, position.turn, prevMove, null);
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
	
	return new SearchState(wcs, bcs, board, state.turn, prevMove, state.lockedPieceIndex);
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
	
	// If a piece is locked in a multiple capture sequence, it is the only piece that can move, and it must jump
	if (state.lockedPieceIndex !== null) {
		const moves = possibleMoves(sideChar, state.lockedPieceIndex, state);
		return moves.filter(m => m.type);
	}
	
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

	evaluatePosition(position) {
		const state = toSearchState(position);
		return this.evaluate(state);
	}

	getSearchEvaluation(position) {
		const state = toSearchState(position);
		const savedStats = this.stats;
		this.stats = 0;
		const evalScore = this.minMax(state, 6, -Infinity, Infinity);
		this.stats = savedStats;
		this.lastEval = evalScore;
		return evalScore;
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
			const temp = this.minMax(positions[i], 7, -Infinity, Infinity);
			
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
		let promoted = false;
		if (side === 'B') {
			if (!piece[2] && my === 7) {
				piece[2] = true;
				promoted = true;
			}
		} else {
			if (!piece[2] && my === 0) {
				piece[2] = true;
				promoted = true;
			}
		}
		
		// Handle capture and double jump checks
		let doubleJumpPossible = false;
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
			
			// If not promoted to king on this move, check for double jump
			if (!promoted) {
				const nextJumps = possibleMoves(side, index, state).filter(m => m.type);
				if (nextJumps.length > 0) {
					doubleJumpPossible = true;
				}
			}
		}
		
		if (doubleJumpPossible) {
			state.lockedPieceIndex = index;
			// Turn remains the same
		} else {
			state.lockedPieceIndex = null;
			// Switch turn
			state.turn = !state.turn;
		}
	}

	// this function grades how good a move is for the ai
	// the higher the score, the better the move
	evaluate(state, depth = 0) {
		let wcc = 0;
		let bcc = 0;
		let wkc = 0;
		let bkc = 0;
		
		// Checker advancement
		let wAdv = 0;
		let bAdv = 0;
		// King center control
		let wCenter = 0;
		let bCenter = 0;
		
		for (let i = 0; i < 12; i++) {
			const wp = state.wcs[i];
			if (!wp[3]) {
				wcc++;
				if (wp[2]) {
					wkc++;
					// Center control for White King: stay in central coordinates [2,5]
					if (wp[0] >= 2 && wp[0] <= 5 && wp[1] >= 2 && wp[1] <= 5) {
						wCenter += 0.1;
					}
				} else {
					// Checker advancement for White non-king: moves up (y goes from 7 to 0)
					wAdv += 0.05 * (7 - wp[1]);
				}
			}
			const bp = state.bcs[i];
			if (!bp[3]) {
				bcc++;
				if (bp[2]) {
					bkc++;
					// Center control for Black King: stay in central coordinates [2,5]
					if (bp[0] >= 2 && bp[0] <= 5 && bp[1] >= 2 && bp[1] <= 5) {
						bCenter += 0.1;
					}
				} else {
					// Checker advancement for Black non-king: moves down (y goes from 0 to 7)
					bAdv += 0.05 * bp[1];
				}
			}
		}
		
		if (wcc === 0) return 1000 + depth; // Black (AI) wins
		if (bcc === 0) return -1000 - depth; // White (Player) wins
		
		// Check for no legal moves (forced loss by blocking)
		const moves = allMovesPossible(state.turn, state);
		if (moves.length === 0) {
			return state.turn ? 1000 + depth : -1000 - depth; // If White has no moves, Black wins (+1000), and vice versa
		}

		let score = bcc - wcc + (2 * (bkc - wkc));
		
		// Apply positional bonuses
		score += bAdv - wAdv;
		score += bCenter - wCenter;
		
		// Chebyshev distance endgame hunting/escaping
		if (bcc > 0 && wcc > 0 && bcc !== wcc) {
			let sumDistance = 0;
			let count = 0;
			for (let i = 0; i < 12; i++) {
				const bp = state.bcs[i];
				if (bp[3]) continue;
				for (let j = 0; j < 12; j++) {
					const wp = state.wcs[j];
					if (wp[3]) continue;
					const dist = Math.max(Math.abs(bp[0] - wp[0]), Math.abs(bp[1] - wp[1]));
					sumDistance += dist;
					count++;
				}
			}
			if (count > 0) {
				const avgChebyshevDistance = sumDistance / count;
				if (bcc > wcc) {
					// Black leading: close the distance (hunt)
					score += 0.05 * (7 - avgChebyshevDistance);
				} else {
					// Black losing: increase the distance (escape)
					score += 0.05 * avgChebyshevDistance;
				}
			}
		}
		
		return score;
	}

	// standard implementation of a minMax algorithm with alpha beta pruning
	// uses state.turn dynamically to decide whether to maximize or minimize
	minMax(state, depth, alpha, beta) {
		this.stats ++;
		
		const isGameOver = this.gameOver(state);
		
		if (depth === 0 || isGameOver) {
			const score = this.evaluate(state, depth);
			return score;
		}
	
		if (state.turn === false) { // Black/AI's turn (Maximizer)
			let maxEval = -Infinity;
			const positions = this.getPositions(state);
			for (let i = 0; i < positions.length; i ++ ) {
				const ev = this.minMax(positions[i], depth - 1, alpha, beta);
				maxEval = Math.max(maxEval, ev);
				alpha = Math.max(alpha, ev);
				if (beta <= alpha) {
					break;
				}
			}
			return maxEval;
	
		} else { // White/Player's turn (Minimizer)
			let minEval = Infinity;
			const positions = this.getPositions(state);
			for (let i = 0; i < positions.length; i ++ ) {
				const ev = this.minMax(positions[i], depth - 1, alpha, beta);
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
	
	// Helper method to check if game is over (no pieces or no legal moves left)
	gameOver(state) {
		let wcc = 0;
		let bcc = 0;
		for (let i = 0; i < 12; i++) {
			if (!state.wcs[i][3]) wcc++;
			if (!state.bcs[i][3]) bcc++;
		}
		if (wcc === 0 || bcc === 0) return true;
		
		const moves = allMovesPossible(state.turn, state);
		return moves.length === 0;
	}
}

export {AI}
