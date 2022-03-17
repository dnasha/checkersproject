// Dan Sharan

// global variables and arrays
var tiles = document.getElementsByClassName("tile");
var b_tiles = document.getElementsByClassName("black_square");
var w_tiles = document.getElementsByClassName("white_square");

var w_checkers = document.getElementsByClassName("white_checker");
var b_checkers = document.getElementsByClassName("black_checker");

// piece counts 
var wPieceCount = w_checkers.length;
var bPieceCount = b_checkers.length;
var wKingCount = 0;
var bKingCount = 0;

// singular elements
var resetButton = document.getElementById("reset");

var playArea = document.getElementById("board");
var turnText = document.getElementById("turn");

var botSwitch = document.getElementById("botMode");
var vsBot = document.getElementById("botMode").checked;

// picked a piece up
var holding = false;

// held piece
var held;

// false = black   true = white
var turn = true;

// no win yet
var gameOver = false;

var winner = null;

// arrays of checker objects
var wcs = [];
var bcs = [];

// logical (non visual) board
var posBoard; 

// indicators
var inds = document.getElementsByClassName("indicator");

//how the bot sees the world (0)(0)
//                            (___)
var pos; 

var pMoves;

// setup + runtime
window.onload = function() {
	start();
}

function start() {
	setUpBoard();
	setUpPieces();
	populateArrays();
	
	posBoard = 
	[
	[bcs[0], null, bcs[1], null, bcs[2], null, bcs[3], null],

	[null, bcs[4], null, bcs[5], null, bcs[6], null, bcs[7]],

	[bcs[8], null, bcs[9], null, bcs[10], null, bcs[11], null],

		[null, null, null, null, null, null, null, null],

		[null, null, null, null, null, null, null, null],

	[null, wcs[0], null, wcs[1], null, wcs[2], null, wcs[3]],

	[wcs[4], null, wcs[5], null, wcs[6], null, wcs[7], null],

	[null, wcs[8], null, wcs[9], null, wcs[10], null, wcs[11]]
	];

	clickListeners();
	if (!vsBot){
		clickListenersBlack();
	}
	//pos = new position(wPieceCount, bPieceCount, wKingCount, bKingCount);
}

function switchBot() {
	vsBot = !vsBot;
}

// make the pieces do things once clicked
function clickListeners() {
	
	for (let i = 0; i < 12; i ++) {
		var element = wcs[i].source;
		element.addEventListener("click", function(){act(wcs[i]);});
	}

	for (let i = 0; i < 32; i ++) {
		var tile = b_tiles.item(i);

		tile.addEventListener("click", function(){move(b_tiles.item(i));});
	}

	for (let i = 0; i < 32; i ++) {
		var tile = w_tiles.item(i);
		tile.addEventListener("click", function(){resetHeld();});
	}

	resetButton.addEventListener("click", function(){resetGame();});
	botSwitch.addEventListener("change", function(){switchBot();});
}

// adds interaction to black if the bot 
// is off
function clickListenersBlack() {
	for (let i = 0; i < 12; i ++) {
		var element = bcs[i].source;
		element.addEventListener("click", function(){act(bcs[i]);});
	}
}

// piece grab logic
function act(checker) {
	if (vsBot && !turn){
		bot();
	} else {
		if (!holding && checker.color == "w" && turn) {
			holding = true;
			resetHeld();
			held = checker;
			pMoves = possibleMoves(held);
			checker.source.style.borderColor = "red";
			playArea.style.cursor = "-webkit-grabbing";
			indicate(pMoves);
		} else if (!holding && checker.color == "b" && !turn) {
			holding = true;
			resetHeld();
			held = checker;
			pMoves = possibleMoves(held);
			checker.source.style.borderColor = "red";
			playArea.style.cursor = "-webkit-grabbing";
			indicate(pMoves);
		} else {
			resetHeld();
			holding = false;
		}
	}
}

// resets held piece status
function resetHeld() {
	if (held != null) {
		if (held.color == "w") {
				held.source.style.borderColor = "black";
			} else if (held.color == "b") {
				held.source.style.borderColor = "white";
		}
	}
	held = null;
	playArea.style.cursor = "-webkit-grab";
	resetInds();
}

// t = target tile
function move(t) {
	if (!forcedAttack()) {
	 if (holding && properMove(t)) {
		updatePosition([t.style.left, t.style.top]);
		turnSwitch();
		resetHeld();
		} else {
			resetHeld();
		}
	} else {
		if (holding && possibleMovesHasTile(t)) {
			updatePosition([t.style.left, t.style.top]);
			turnSwitch();
			resetHeld();
		} 
	}
	holding = false;
}

function possibleMovesHasTile(t) {
	var tX = parseInt(t.style.left.replace("px", ""))/80;
	var tY = parseInt(t.style.top.replace("px", ""))/80; 

	if (pMoves.includes([tX, tY])) {
		return true;
	} else {
		return false;
	}
}

// checks if a move is legal
function properMove(t) {
	//var piece = held;

	var tileX = parseInt(t.style.left.replace("px", ""))/80;
	var tileY = parseInt(t.style.top.replace("px", ""))/80;
	properMove([tileX, tileY]);
	
	var pieceX = held.position[0];
	var pieceY = held.position[1];

	if (posBoard[tileY][tileX] != null) {
		return false;
	}

	if (checkAttack(tileX, tileY, pieceX, pieceY, false)) {
		return true;
	}
	// console.log(tileX);
	// console.log(tileY);
	// console.log();
	// console.log(pieceX);
	// console.log(pieceY);

	if (piece.king) {
		if (pieceY + 1 < tileY || pieceY - 1 > tileY) {
			return false;
		}
	} else if (turn) {
		if (pieceY < tileY || pieceY - 1 > tileY) {
			return false;
		}
	} else {
		if (pieceY > tileY || pieceY + 1 < tileY) {
			return false;
		}
	}

	if (pieceX + 1 < tileX || pieceX - 1 > tileX) {
		return false;
	}

	return true;
	
}

function indicate(moves) {

	console.log(moves);

	for (let i = 0; i < moves.length; i++) {
		var ind = inds.item(i);
		
		ind.style.left = (moves[i][0] * 80) + "px";
		ind.style.top = (moves[i][1] * 80) + "px";
		ind.style.visibility = "visible";
	}
}

function resetInds() {
	for (let i = 0; i < inds.length; i ++) {
		inds.item(i).style.visibility = "hidden";
	}
}

function possibleMoves(piece) {
	var x = piece.position[0];
	var y = piece.position[1];
	
	var moves = [
		[x+1, y+1],
		[x+1, y-1],
		[x-1, y+1],
		[x-1, y-1],
		[x+2, y+2],
		[x+2, y-2],
		[x-2, y+2],
		[x-2, y-2]
	];

	for (let i = moves.length - 1; i >= 0; i --) {
		if (!validMove(moves[i])) {
			moves.splice(i, 1);
		}
	}

	return moves;
}

function validMove(cord) {
	var pX = held.position[0];
	var pY = held.position[1];

	var tX = cord[0];
	var tY = cord[1];

	if ((0 > tX || tX > 7) || (0 > tY || tY > 7)) {
		return false;
	}

	if (posBoard[tY][tX] != null) {
		return false;
	}
	
	if (checkAttack(tX, tY, pX, pY, true)) {
		var piece = posBoard[(tY+pY)/2][(tX+pX)/2];
		var type = piece.color;

		if (turn && type == "w") {
			return false;
		} else if (!turn && type == "b") {
			return false;
		}
	} else {
		if (held.king) {
			if (pY + 1 < tY || pY - 1 > tY) {
				return false;
			}
		} else if (turn) {
			if (pY < tY || pY - 1 > tY) {
				return false;
			}
		} else {
			if (pY > tY || pY + 1 < tY) {
				return false;
			}
		}

		if (pX + 1 < tX || pX - 1 > tX) {
			return false;
		}
	}
	
	return true;
}

// updates visual and mathematical
// piece position
function checkAttack(tx, ty, px, py, theory) {
	var targetX = (tx+px)/2;
	var targetY = (ty+py)/2;

	if (held.king && Math.abs(tx-px) == 2 && Math.abs(ty-py) == 2) {
		if (posBoard[targetY][targetX] == null) {
			return false;
		}
		if (!theory) {
			return attack(targetX, targetY);
		} else {
			return true;
		}
		
	} else {
		if (turn && Math.abs(tx-px) == 2 && ty-py == -2) {
			if (posBoard[targetY][targetX] == null) {
				return false;
			}
			if (!theory) {
				return attack(targetX, targetY);
			} else {
				return true;
			}
			
		} else if (!turn && Math.abs(tx-px) == 2 && ty-py == 2) {
			if (posBoard[targetY][targetX] == null) {
				return false;
			}
			if (!theory) {
				return attack(targetX, targetY);
			} else {
				return true;
			}

		}
	} 
}

function forcedAttack () {
	if (turn) {
		for (let i = 0; i < wcs.length; i++) {
			var piece = wcs[i];
			var pX = piece.position[0];
			var pY = piece.position[1];

			if (piece.king) {
				
			}

			if (possibleMoves(piece).includes([pX + 2, pY - 2]) || 
			possibleMoves(piece).includes([pX - 2, pY - 2])) {
				return true;
			}
		}
	} else {
		for (let i = 0; i < bcs.length; i++) {
			var piece = wcs[i];
			var pX = piece.position[0];
			var pY = piece.position[1];

			if (piece.king) {
				
			}

			if (possibleMoves(piece).includes([pX + 2, pY - 2]) || 
			possibleMoves(piece).includes([pX - 2, pY - 2])) {
				return true;
			}
		}
	}
}

// attacks a piece
function attack(px, py) {
	var piece = posBoard[py][px];
	var type = piece.color;

	var hX = held.position[0];
	var hY = held.position[1];

	if (turn && type == "w") {
		return false;
	} else if (!turn && type == "b") {
		return false;
	}
	
	piece.source.style.visibility = "hidden";

	hX = held.position[0];
	hY = held.position[1];

	posBoard[hY][hX] = null;
	

	if (!turn) {
		wPieceCount--;

		var index = wcs.indexOf(posBoard[py][px]);
		wcs.splice(index, 1, null);

	} else {
		bPieceCount--;

		var index = bcs.indexOf(posBoard[py][px]);
		bcs.splice(index, 1, null);
	}
	console.log(wcs.toString());

	posBoard[py][px] = null;
	
	
	//console.log(wPieceCount);
	//console.log(bPieceCount);
	return true;
}

// updates location of checker
function updatePosition(newPos) {
	var piece = held;
	
	var newX = newPos[0];
	var newY = newPos[1];

	piece.source.style.left = newX;
	piece.source.style.top = newY;

	newX = parseInt(newX.replace("px", ""))/80;
	newY = parseInt(newY.replace("px", ""))/80;

	posBoard[piece.position[1]][piece.position[0]] = null;
	posBoard[newY][newX] = piece;

	piece.position[0] = newX;
	piece.position[1] = newY;

	if (newY == 0 || newY == 7 ) {
		checkIfKing(piece);
	}

	console.log(posBoard);
	console.log(wcs.toString());
	resetHeld();
}

// checks if a piece is a king 
// and appoints it if it is one
function checkIfKing(piece) {
	if (!piece.king) {
		if (piece.color == "w" && piece.position[1] == 0) {
			crownPiece(piece);
		} else if (piece.color == "b" && piece.position[1] == 7) {
			crownPiece(piece);
		}
	}
}

// turns a piece into a king
function crownPiece(piece) {
	piece.king = true;
	if (piece.color == "b") {
		bKingCount++;
		piece.source.style.backgroundImage = "radial-gradient(black, rgb(50, 50, 50), rgb(150, 150, 150))";
	} else if (piece.color == "w"){
		wKingCount++;
		piece.source.style.backgroundImage = "radial-gradient(white, rgb(150, 150, 150), black)";
	}
}

// switches turns
function turnSwitch() {

	win();
	turn = !turn;
	if (turn) {
		turnText.innerHTML = "Whites turn...";
		turnText.style.color = "white";
		turnText.style.webkitTextStrokeWidth = "1px";
		turnText.style.webkitTextStrokeColor = "black";
	} else {
		turnText.innerHTML = "Blacks turn...";
		turnText.style.color = "black";
		turnText.style.webkitTextStrokeWidth = "1px";
		turnText.style.webkitTextStrokeColor  = "white";
	}
	
}

// aranges the locations of the tiles
function setUpBoard() {
	var leftPrev = 0;
	var topPrev = 0;

	for (var i = 0; i < 8; i ++) {
		for (var j = i * 8; j < i * 8 + 8; j ++) {
			
			square = tiles.item(j);

			square.style.left = leftPrev + "px";
			square.style.top = topPrev + "px";

			leftPrev += 80;
		}

		leftPrev = 0;
		topPrev += 80;
	}
}

// aranges initial locations of the checkers
function setUpPieces() {

	for (var i = 0; i < bPieceCount; i ++) {
		square = b_tiles.item(i);
		bPiece = b_checkers.item(i);
		
		bPiece.style.left = square.style.left;
		bPiece.style.top = square.style.top;
	}

	for (var i = 0; i < wPieceCount; i ++) {
		square = b_tiles.item(20 + i);
		wPiece = w_checkers.item(i);

		wPiece.style.left = square.style.left;
		wPiece.style.top = square.style.top;
	}

}

// the checker piece object
class checker {
  constructor(position, color, source, king) {
	// row, collumn
	//[x,y]
    this.position = position;
    this.color = color;
	this.source = source;
	this.king = king;
  }

  toString() {
  	return this.color;
  }
}

// fills arrays of pieces with checker objects
function populateArrays() {
	var x = 0;
	var y = 0;

	for (var i = 1; i <= bPieceCount; i ++) {

		bcs.push(new checker([x, y], "b", b_checkers.item(i-1), false));

		if (i % 8 == 0) {
			x = 0;
		} else if (i % 4 == 0 ) {
			x = 1;
		} else {
			x += 2;
		}

		if (i % 4 == 0) {
			y ++;
		}
	}

	x = 1;
	y = 5;

	for (var i = 1; i <= wPieceCount; i ++) {

		wcs.push(new checker([x, y], "w", w_checkers.item(i-1), false));

		if (i % 8 == 0) {
			x = 1;
		} else if (i % 4 == 0 ) {
			x = 0;
		} else {
			x += 2;
		}

		if (i % 4 == 0) {
			y ++;
		}
	}
}

function win() {
	if (wPieceCount == 0) {
		winner = "b";
		gameOver = true
	} else if (bPieceCount == 0) {
		winner = "w";
		gameOver = true;
	}

	if (gameOver) {
		stopGame();
	}
}

function stopGame() {

	turnText.style.visibility = "hidden";

	if (winner == "w") {
		alert("white wins");
	} if (winner == "b") {
		alert("black wins");
	}

	resetButton.style.visibility = "visible";
}

function resetGame() {
	
	turnText.innerHTML = "Whites turn...";
	turnText.style.color = "white";
	turnText.style.webkitTextStrokeWidth = "1px";
	turnText.style.webkitTextStrokeColor = "black";
	turnText.style.visibility = "visible";

	turn = true;
	wcs = [];
	bcs = [];

	wPieceCount = 12;
	bPieceCount = 12;

	wKingCount = 0;
	bKingCount = 0;

	setUpPieces();
	populateArrays();

	winner = null;
	gameOver = false;
	
	posBoard = 
	[
	[bcs[0], null, bcs[1], null, bcs[2], null, bcs[3], null],

	[null, bcs[4], null, bcs[5], null, bcs[6], null, bcs[7]],

	[bcs[8], null, bcs[9], null, bcs[10], null, bcs[11], null],

		[null, null, null, null, null, null, null, null],

		[null, null, null, null, null, null, null, null],

	[null, wcs[0], null, wcs[1], null, wcs[2], null, wcs[3]],

	[wcs[4], null, wcs[5], null, wcs[6], null, wcs[7], null],

	[null, wcs[8], null, wcs[9], null, wcs[10], null, wcs[11]]
	];

	for (let i = 0; i < 12; i ++) {
		w_checkers.item(i).style.visibility = "visible";
		w_checkers.item(i).style.backgroundImage = "none";
		b_checkers.item(i).style.visibility = "visible";
		b_checkers.item(i).style.backgroundImage = "none";
	}

	resetButton.style.visibility = "hidden";

}

function bot() {
	var copyBoard = [];

	for (var i = 0; i < posBoard.length; i++) {
    	copyBoard[i] = posBoard[i].slice();
	}
	
	var state = new position(wPieceCount, bPieceCount, wKingCount, bKingCount, copyBoard);

	var moves = getPositions(state);
	shuffleArray(moves);

	var potential = [];
	for (let i = 0; i < moves.length; i ++ ) {
		var moveScore = minMax(position, true, 5, -Infinity, +Infinity);
		potential.push(bestMove);
	}

	var bestMove = moves[moves.indexOf(Math.max(...potential))];
	implementMove(bestMove);
}

function implementMove(bestMove) {

}

function getPositions(position) {
}

// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
// o(n) shuffle alogrithm
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}


class position {
  constructor(wp, bp, wk, bk, board) {
	  this.wp = wp;
	  this.bp = bp;
	  this.wk = wk;
	  this.bk = bk;
	  this.gameOver = false;
	  this.board = board;
  }
}

function eval(pos) {

	wp = position.wp;
	bp = position.bp;
	wk = position.wk;
	bk = position.bk;

	return bp-wp + (bk - wk);
}


function minMax(state, player, depth, alpha, beta) {

	if (depth == 0 || state.gameOver) {
		return eval(state);
	}

	if (player) {
		var maxEval = -Infinity;
		moves = getPositions(state);
		for (let i = 0; i < moves.length; i ++ ) {
			eval = minMax(moves[i], player, depth - 1, alpha, beta);
			maxEval = Math.max(maxEval, eval);
			alpha = Math.max(alpha, eval);
			if (beta <= alpha) {
				break;
			}
		}
		return maxEval;

	} else {
		var minEval = Infinity;
		moves = getPositions(state);
		for (let i = 0; i < moves.length; i ++ ) {
			eval = minMax(moves[i], player, depth - 1, alpha, beta);
			minEval = Math.min(minEval, eval);
			beta = Math.min(beta, eval);
			if (beta <= alpha) {
				break;
			}
		}
		return minEval;
	}

}
//function pointer(on, tile) {
//	if (on) {
//		tile.style.cursor = "pointer";
//	} 
//}

