import {vPos} from "./vPos.js";
import {Position} from "./fPos.js";
import {Checker} from "./checker.js";
import {Move} from "./move.js";
import {AI} from "./AI.js";
import {checkerSound} from "./checkerSound.js";
import {PieceTracker} from "./pieceTracker.js";

// Developed by Dan Sharan

// ***************global vars***************

//audio 
var sound = new checkerSound();
var attackPlayed = false;

// everything
var content = document.getElementById("everything");

// element lists *******

// all tiles DOM
var tiles = document.getElementsByClassName("tile");

// black tiles DOM
var bTiles = document.getElementsByClassName("black_square");

// white tiles DOM
var wTiles = document.getElementsByClassName("white_square");

// white checkers DOM
var wCheckers = document.getElementsByClassName("white_checker");

// black checkers DOM
var bCheckers = document.getElementsByClassName("black_checker");

// all checkers
var checkers = document.getElementsByClassName("checker");

// black and white mini piece trackers
var blackTaken = document.getElementsByClassName("whiteMini");
var whiteTaken = document.getElementsByClassName("blackMini");

var bTk = new PieceTracker(blackTaken);
var wTk = new PieceTracker(whiteTaken);

// piece counts
var wPieceCount = wCheckers.length;
var bPieceCount = bCheckers.length;
var wKingCount = 0;
var bKingCount = 0;

// singular elements
var playArea = document.getElementById("board");
//var turnText = document.getElementById("turn");
var resetButton = document.getElementById("reset");
var forcedLaw = document.getElementById("forcedLaw");

// indicators
var inds = document.getElementsByClassName("indicator");

// held piece
var held;

// grabbed a piece
var holding = false;

// false = black   true = white
var turn = true;

var started = false;

var prevMove = null;
// arrays of checker objects
var wcs = [];
var bcs = [];

// 2d representation of the board
var posBoard;

// computer representation of the position
var basePosition;

// win variables
var gameOver = false;
var moveCount = 0;
var winner = null;

var vp;

var forcedMoves = [];
var forced = false;

//var jumper;
//undo moves
//var undoButton = document.getElementById("undo");
//var redoButton = document.getElementById("redo");
//var prevMoves = [];
//var undoPos = 0;

// ai
var ai;
var bot = true;

// timer
var whiteSeconds = 60;
var blackSeconds = 60;
var whiteSeconds = 31536003;
var blackSeconds = 31536003;

var timerWhite = document.getElementById("timerWhite");
var timerBlack = document.getElementById("timerBlack");

var whitePause = false;
var blackPause = false;
// ***************setup functions***************

// setup
window.onload = function start() {

	vp = new vPos(tiles, bTiles, wCheckers, bCheckers, wPieceCount, bPieceCount);
	vp.layoutBoard();
	
	content.style.visibility = "visible";
	
	for (let i = 0; i < checkers.length; i ++) {
		checkers.item(i).style.visibility = "visible";
	}
	
	populateArrays();
	clickListeners();

	posBoard = 
	[
	[null, bcs[0], null, bcs[1], null, bcs[2], null, bcs[3]],

	[bcs[4], null, bcs[5], null, bcs[6], null, bcs[7], null],

	[null, bcs[8], null, bcs[9], null, bcs[10], null, bcs[11]],

		[null, null, null, null, null, null, null, null],

		[null, null, null, null, null, null, null, null],

	[wcs[0], null, wcs[1], null, wcs[2], null, wcs[3], null],

	[null, wcs[4], null, wcs[5], null, wcs[6], null, wcs[7]],

	[wcs[8], null, wcs[9], null, wcs[10], null, wcs[11], null]
	];
	
	basePosition = new Position(wcs, bcs, posBoard, wKingCount, bKingCount, wPieceCount, bPieceCount, moveCount, turn, prevMove);

	
	ai = new AI(basePosition);
	//prevMoves.push(basePosition);
	//console.log(basePosition.toString());
}

// fills arrays of pieces with checker objects
function populateArrays() {
	var x = 1;
	var y = 0;

	for (var i = 1; i <= bPieceCount; i ++) {

		bcs.push(new Checker([x, y], "B", bCheckers.item(i-1), false));

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

	x = 0;
	y = 5;

	for (var i = 1; i <= wPieceCount; i ++) {

		wcs.push(new Checker([x, y], "W", wCheckers.item(i-1), false));

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
}

// adds click listeners to white pieces and all tiles
function clickListeners() {
	
	for (let i = 0; i < wPieceCount; i ++) {
		var checker = wcs[i].source;
		checker.addEventListener("click", function(){clicked(wcs[i]);});
	}

	for (let i = 0; i < bTiles.length; i ++) {
		var tile = bTiles.item(i);
		tile.addEventListener("click", function(){checkMove(bTiles.item(i), false);});
	}

	for (let i = 0; i < wTiles.length; i ++) {
		var tile = wTiles.item(i);
		tile.addEventListener("click", function(){resetHeld();});
	}
	
	resetButton.addEventListener("click", function(){resetGame();});
	clickListenersBlack();
	//clickListenersTimeTravel();
}

// adds click listeners to black pieces
function clickListenersBlack() {
	//if (!bot) {
		for (let i = 0; i < bPieceCount; i ++) {
			var checker = bcs[i].source;
			checker.addEventListener("click", function(){clicked(bcs[i]);});
		}
	//}
	
}

/*
function clickListenersTimeTravel() {
	undoButton.addEventListener("click", function(){undo();});
	redoButton.addEventListener("click", function(){redo();});
}
*/

// ***************logic functions***************

// if a checker is clicked
function clicked(checker) {
	if (!gameOver) {
		if (holding) {
			resetHeld();
		}
	
		if (!holding && checker.color === "W" && turn) {
			activatePiece(checker);
		} else if (!holding && checker.color === "B" && !turn) {
			activatePiece(checker);
		} else {
			resetHeld();
		}
	}

}

// activates a piece visually
function activatePiece(checker) {
	if (!started) {
		timer(true);
		sound.startS();
		started = true;
	}
	if (forced) {
		sound.checkS();
		if (forcedPiece(checker)) {
			holding = true;
			held = checker;
		} else {
			holding = true;
			held = forcedMoves[0].piece;
		}
		
		held.source.style.borderColor = "red";
		playArea.style.cursor = "-webkit-grabbing";
		
	} else if (!forced) {
		holding = true;
		held = checker;
	
		held.source.style.borderColor = "red";
		playArea.style.cursor = "-webkit-grabbing";
	}
	
	if (holding) {
		indicate(possibleMoves(held));
	}
	
	if (!forcedLaw.checked) {
		forced = false;
		forcedMoves = [];
	}
	/*
	var pm = possibleMoves(held);
	
	for (let i = 0; i < pm.length; i ++) {
		console.log(pm[i].toString());
	}
	for (let i = 0; i < forcedMoves.length; i ++) {
		console.log(forcedMoves[i].toString());
	}
	*/
}

// resets the held piece
function resetHeld() {

	if (held != null) {
		if (held.color === "W") {
				held.source.style.borderColor = "black";
			} else if (held.color === "B") {
				held.source.style.borderColor = "white";
		}
	}
	held = null;
	holding = false;
	//jumper = null;
	playArea.style.cursor = "-webkit-grab";
	resetInds();
}

// checks to see if a move can be done
function checkMove(t) {

	var tX = parseInt(t.style.left.replace("px", ""))/80;
	var tY = parseInt(t.style.top.replace("px", ""))/80;
	
	var tempMove = new Move(held, [tX,tY], false);
	if (holding) {
		if (forced && forcedLaw.checked) {
			tempMove = new Move(held, [tX,tY], true);
			if (hasMove(tempMove)) {
				checkAttack(tX, tY, held.location[0], held.location[1], false);
				prevMove = tempMove;
				
				move([tX, tY]);
			} else {
				resetHeld();
			}
		} else {
			if (isValidMove(tempMove, held, false)) {
				prevMove = tempMove;
				
				move([tX, tY]);
			} else {
				resetHeld();
			}
		}
	}
}

//parses and executes AI moves
function aiMove() {
	
	resetHeld();
	
	holding = true;
	
	//console.log(ai.position.toString());
	ai.update(basePosition);
	//console.log(ai.position.toString());
	
	var moveAI = ai.getMove();
	
	//console.log(moveAI);
	
	held = moveAI.piece;
	var attacking = moveAI.type;
	var cords = moveAI.cords;
	
	var tX = moveAI.cords[0];
	var tY = moveAI.cords[1];
	var pX = held.location[0];
	var pY = held.location[1];

	tX = (pX + tX) / 2;
	tY = (pY + tY) / 2;
	//console.log(pX);
	//console.log(pY);
	
	//console.log(tX);
	//console.log(tY);

	//console.log(moveAI);
	
	if (attacking) {
		attack(tX, tY);
	} 
	move(cords);
	ai.update(basePosition);
	
}
// checks if a move is valid
function isValidMove(move, piece, theory) {
	if (!holding) {
		return false;
	}
	
	var pX = piece.location[0];
	var pY = piece.location[1];

	var tX = move.cords[0];
	var tY = move.cords[1];
	
	if ((0 > tX || tX > 7) || (0 > tY || tY > 7)) {
		return false;
	}
	
	if (posBoard[tY][tX] != null) {
		return false;
	}
	
	if (Math.abs(tX-pX) == 2 && Math.abs(tY-pY) == 2 && checkAttack(tX, tY, pX, pY, theory)) {
		return true;
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

// moves a piece
function move(newCords) { 
	var piece = held;
	var king = piece.king;
	var crowned = piece.king;
	
	var newX = newCords[0];
	var newY = newCords[1];
	
	piece.source.style.left = (newX * 80) + "px";
	piece.source.style.top = (newY * 80) + "px";

	if (attackPlayed) {
		if (turn) {
			wTk.show();
		} else {
			bTk.show();
		}
		sound.attackS();
	} else {
		sound.moveS();
	}
		
	posBoard[piece.location[1]][piece.location[0]] = null;
	posBoard[newY][newX] = piece;

	piece.location[0] = newX;
	piece.location[1] = newY;
	
	if (newY == 0 || newY == 7 ) {
		checkIfKing(piece);
		crowned = piece.king;
	}
	
	//console.log(basePosition.toString());
	
	if (forced || attackPlayed) {

		//console.log(forced);
		forcedAttack();
		//console.log(forced);

		var temp = [];
		forced = false;
		for (let i = 0; i < forcedMoves.length; i ++) {
			if (forcedMoves[i].piece.equals(held)) {
				forced = true;
				temp.push(forcedMoves[i]);
			}	
		}

		forcedMoves = temp;
	}
	
	if (king != crowned) {
		forced = false;
		forcedMoves = [];
	}
	//console.log(forced);
	//console.log(forcedMoves);
	
	resetInds();
	indicate(held);
	
	if (!forced) {
		turnSwitch();
		resetHeld();
	}
	
	attackPlayed = false;
}

// switches the turn
function turnSwitch() {
	
	//console.log(prevMove);
	
	moveCount ++;
	//undoPos = moveCount;
	
	if (moveCount >= 20) {
		checkWin();
	}
	if (!gameOver) {
		
		if (!forced) {
			turn = !turn;
		}
		
		if (forcedLaw.checked) {
			forcedAttack();
		}
		
		if (turn) {
			timerBlack.style.opacity = .4;
			timerWhite.style.opacity = 1;
			whitePause = false;
			blackPause = true;
			blackSeconds += 3;
		} else {
			timerBlack.style.opacity = 1;
			timerWhite.style.opacity = .4;
			whitePause = true;
			blackPause = false;
			whiteSeconds += 3;
		}
		
		timer(turn);
	}
	//console.log(forced);
	//console.log(forcedMoves);
	
	//prevMoves.push(basePosition);
	/*
	if (turn) {
		turnText.innerHTML = "Whites turn...";
		turnText.style.color = "white";
		turnText.style.webkitTextStrokeWidth = "2px";
		turnText.style.webkitTextStrokeColor = "black";

	} else {
		turnText.innerHTML = "Blacks turn...";
		turnText.style.color = "black";
		turnText.style.webkitTextStrokeWidth = "1px";
		turnText.style.webkitTextStrokeColor  = "white";
	}
	*/
	
	basePosition = new Position(wcs, bcs, posBoard, wKingCount, bKingCount, wPieceCount, bPieceCount, moveCount, turn, prevMove);
	
	//console.log(basePosition.toString());
	
	if (!turn && bot) {
		ai.update(posBoard);
		aiMove();
	}
	
}

// checks if a piece is a king 
// and appoints it if it is one
function checkIfKing(piece) {
	if (!piece.king) {
		if (piece.color === "W" && piece.location[1] == 0) {
			crownPiece(piece);
		} else if (piece.color === "B" && piece.location[1] == 7) {
			crownPiece(piece);
		}
	}
}

// turns a piece into a king
function crownPiece(piece) {
	piece.king = true;
	if (piece.color === "B") {
		bKingCount++;
		piece.source.style.backgroundImage = "radial-gradient(black, rgb(50, 50, 50), rgb(150, 150, 150))";
	} else if (piece.color === "W"){
		wKingCount++;
		piece.source.style.backgroundImage = "radial-gradient(white, rgb(150, 150, 150), black)";
	}
}

// updates visual and mathematical
// piece position
function checkAttack(tx, ty, px, py, theory) {
	
    if (!turn && bot) {
		return true;
	}
	
	var targetX = (tx+px)/2;
	var targetY = (ty+py)/2;

	if (posBoard[targetY][targetX] == null) {
		return false;
	}

	var type = posBoard[targetY][targetX].color;

	if (turn && type === "W") {
		return false;
	} else if (!turn && type === "B") {
		return false;
	}
	//whitePause = true;
	//blackPause = false;

	if (posBoard[py][px].king && Math.abs(tx-px) == 2 && Math.abs(ty-py) == 2) {
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

// attacks a piece
function attack(tX, tY) {
	var piece = posBoard[tY][tX];
	var type = piece.color;

	var hX = held.location[0];
	var hY = held.location[1];

	if (turn && type === "W") {
		return false;
	} else if (!turn && type === "B") {
		return false;
	}
	
	piece.source.style.visibility = "hidden";
	
	attackPlayed = true;
	
	posBoard[tY][tX] = null;

	if (!turn) {
		wPieceCount--;
	} else {
		bPieceCount--;
	}
	
	return true;
}

// indicates possible moves
function indicate(moves) {

	var indicated = [];
	
	if (forced) {
		for (let i = 0; i < forcedMoves.length; i ++) {
			if (held.equals(forcedMoves[i].piece)) {
				indicated.push(forcedMoves[i]);
			}
		}
	} else {
		indicated = moves;
	}
	
	
	for (let i = 0; i < indicated.length; i++) {
		var ind = inds.item(i);
		
		ind.style.left = (indicated[i].cords[0] * 80) + "px";
		ind.style.top = (indicated[i].cords[1] * 80) + "px";
		
		ind.style.backgroundColor = "lightgrey";
		
		if (forced) {
			ind.style.backgroundColor = "orange";
		}
		ind.style.visibility = "visible";
	}
}

// returns possible moves for a given piece
function possibleMoves(piece) {
	var x = piece.location[0];
	var y = piece.location[1];
	
	var moves = [
		new Move(piece, [x+1, y+1], false),
		new Move(piece, [x+1, y-1], false),
		new Move(piece, [x-1, y+1], false),
		new Move(piece, [x-1, y-1], false),
		new Move(piece, [x+2, y+2], true),
		new Move(piece, [x+2, y-2], true),
		new Move(piece, [x-2, y+2], true),
		new Move(piece, [x-2, y-2], true)
	];
	
	for (let i = moves.length - 1; i >= 0; i --) {
		if (!isValidMove(moves[i], piece, true)) {
			moves.splice(i, 1);
		}
	}

	
	return moves;
}

function hasMove(move) {
	for (let i = 0; i < forcedMoves.length; i ++) {
		if (forcedMoves[i].equals(move)) {
			return true;
		}
	}
	return false;
}

// resets move indicators
function resetInds() {
	for (let i = 0; i < inds.length; i ++) {
		inds.item(i).style.visibility = "hidden";
	}
}

function checkWin() {
	
	var wms = allMovesPossible(true);
	var bms = allMovesPossible(false);
	
	var wmc = 0;
	var bmc = 0;
	
	for (var i = 0; i < wms.length; i ++) {
		for (var j = 0; j < wms[i].length; j ++) {
			wmc ++;
		}
	}

	for (var i = 0; i < bms.length; i ++) {
		for (var j = 0; j < bms[i].length; j ++) {
			bmc ++;
		}
	}
	//console.log(wmc + " " + bmc);
	
	if (wPieceCount == 0) {
		winner = "b";
		gameOver = true
	} else if (bPieceCount == 0) {
		winner = "w";
		gameOver = true;
	} else if (wmc == 0) {
		winner = "b";
		gameOver = true;
	} else if (bmc == 0) {
		winner = "w";
		gameOver = true;
	}
	
	if (gameOver) {
		sound.winS();
		stopGame();
	}
}

function stopGame() {
	whitePause = true;
	blackPause = true;
	
	turnText.style.visibility = "hidden";

	if (winner === "w") {
		alert("white wins");
	} if (winner === "b") {
		alert("black wins");
	}

	resetButton.style.visibility = "visible";
}

function resetGame() {
	
	resetHeld();
	
	/*
	turnText.innerHTML = "Whites turn...";
	turnText.style.color = "white";
	turnText.style.webkitTextStrokeColor = "black";
	turnText.style.visibility = "visible";
	*/
	
	turn = true;
	held = null;
	wcs.length = 0;
	bcs.length = 0;

	wPieceCount = 12;
	bPieceCount = 12;
	started = false;
	
	wKingCount = 0;
	bKingCount = 0;
	populateArrays();
	
	vp = new vPos(tiles, bTiles, wCheckers, bCheckers, wPieceCount, bPieceCount);
	vp.layoutBoard();
	
	forcedMoves.length = 0;
	
	winner = null;
	gameOver = false;
	moveCount = 0;
	
	posBoard = 
	[
	[null, bcs[0], null, bcs[1], null, bcs[2], null, bcs[3]],

	[bcs[4], null, bcs[5], null, bcs[6], null, bcs[7], null],

	[null, bcs[8], null, bcs[9], null, bcs[10], null, bcs[11]],

		[null, null, null, null, null, null, null, null],

		[null, null, null, null, null, null, null, null],

	[wcs[0], null, wcs[1], null, wcs[2], null, wcs[3], null],

	[null, wcs[4], null, wcs[5], null, wcs[6], null, wcs[7]],

	[wcs[8], null, wcs[9], null, wcs[10], null, wcs[11], null]
	];
	
	for (let i = 0; i < 12; i ++) {
		wCheckers.item(i).style.visibility = "visible";
		wCheckers.item(i).style.backgroundImage = "none";
		bCheckers.item(i).style.visibility = "visible";
		bCheckers.item(i).style.backgroundImage = "none";
	}
	
	basePosition = new Position(wcs, bcs, posBoard, wKingCount, bKingCount, wPieceCount, bPieceCount, moveCount, turn);
	
	whiteSeconds = 60;
	blackSeconds = 60;
	whitePause = false;
	blackPause = false;

	wTk.reset();
	bTk.reset();
	
	timerWhite.innerHTML = "?";
	timerBlack.innerHTML = "?";
	timerWhite.style.color = "black";
	timerBlack.style.color = "white";
	timerWhite.style.opacity = 1;
	timerBlack.style.opacity = 1;
	
	resetButton.style.visibility = "hidden";
}

function allMovesPossible(side) {
	var prevTurn = turn;
	var allMoves = [];
	
	if (side) {
		turn = true;
		for (let i = 0; i < wcs.length; i ++) {
			if (wcs[i].source.style.visibility === "visible" && !possibleMoves(wcs[i]).length == 0) {
				allMoves.push(possibleMoves(wcs[i]));
			}
		}
	} else {
		turn = false;
		for (let i = 0; i < bcs.length; i ++) {
			if (bcs[i].source.style.visibility === "visible" && !possibleMoves(bcs[i]).length == 0) {
				allMoves.push(possibleMoves(bcs[i]));
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

function forcedAttack() {
	var moves;
	
	if (turn) {
		moves = allMovesPossible(true);
	} else {
		moves = allMovesPossible(false);
	}
	
	forcedMoves.length = 0;
	
	for (var i = 0; i < moves.length; i ++) {
		for (var j = 0; j < moves[i].length; j ++) {
			if (moves[i][j].type) {
				forcedMoves.push(moves[i][j]);
			}
		}
	}
	
	if (forcedMoves.length != 0) {
		forced = true;
	} else {
		forced = false;
	}
}

function forcedPiece(checker) {
	for (let i = 0; i < forcedMoves.length; i ++) {
		if (forcedMoves[i].piece.equals(checker)) {
			return true;
		}
	}
	return false;
}
/*
function undo() {
	undoPos = undoPos--;
	basePosition = prevMoves[undoPos];
	loadPos();
}

function redo() {
	if (undoPos != 0 && undoPos < prevMoves.length - 1) {
		basePosition = prevMoves[undoPos++];
	}
	loadPos();
}

function loadPos() {
	
	turn = basePosition.turn;
	posBoard = basePosition.posBoard;
	moveCount = basePosition.moveCount;
	wcs = basePosition.wcs;
	bcs = basePosition.bcs;
	wPieceCount = basePosition.wpc;
	bPieceCount = basePosition.bpc;
	wKingCount = basePosition.wkc;
	bKingCount = basePosition.bkc;
	
	for (let i = 0; i < wcs; i ++) {
		wcs[i].piece.style.left = (wcs[i].location[0] * 80) + "px";
		wcs[i].piece.style.top = (wcs[i].location[1] * 80) + "px";
	}
	
	for (let i = 0; i < wcs; i ++) {
		bcs[i].piece.style.left = (bcs[i].location[0] * 80) + "px";
		bcs[i].piece.style.top = (bcs[i].location[1] * 80) + "px";
	}
}
*/

function timer(type) {
	
	var interval = 1000;
	var expected = Date.now() + interval;
	let current = moveCount;
	
//https://stackoverflow.com/questions/29971898/how-to-create-an-accurate-timer-in-javascript
	if (type) {
		setTimeout(whiteStep, interval);
	} else {
		setTimeout(blackStep, interval);
	}
	

	function whiteStep() {
		var drift = Date.now() - expected;

		
		if (drift > interval / 4) {
			drift = 0;
		}
		
		whiteSeconds --;
		
		if (whiteSeconds < 10) {
			timerWhite.style.color = "red";
		} else if (whiteSeconds > 10 && timerWhite.style.color === "red") {
			timerWhite.style.color = "black";
		}
		
		var mins = Math.floor(whiteSeconds / 60);
		var hours = Math.floor(mins/60);
		var days = Math.floor(hours/24);
		var years = Math.floor(days/365);
		
		var secs = Math.round(whiteSeconds % 60);
		
		var output = "";

		if (years > 0) {
			output += years + ";";
		} 
		if (days % 365 > 0) {
			output += days % 365 + ":";
		} 
		if (hours % 24 > 0) {
			output += hours % 24 + ":";
		}
		if (mins % 60 > 0) {
			output += mins % 60 + ":";
		} else {
			output += 0 + ":";
		}
		
		
		if (secs < 10) {
			output += "0";
		}
		
		output += secs;
		
		var size = output.length;
		size -= 4;
		size = size * 15 + 80;
		timerWhite.style.width = size + "px"; 
		//timerWhite.style.marginLeft = 640 - size + "px";
		
		timerWhite.innerHTML = output;
		expected += interval;
		
		if (whiteSeconds === 0) {
			whitePause = true;
			winner = "b";
		    gameOver = true;
			sound.winS();
			stopGame();
		}
		if (!whitePause && current == moveCount) {
    		setTimeout(whiteStep, Math.max(0, interval - drift));
		}
	}
	
	function blackStep() {
		var drift = Date.now() - expected;
		
		if (drift > interval / 4) {
			drift = 0;
		}
		
		blackSeconds --;
		
		if (blackSeconds < 10) {
			timerBlack.style.color = "red";
		} else if (blackSeconds > 10 && timerBlack.style.color === "red") {
			timerBlack.style.color = "white";
		}
		
		var mins = Math.floor(blackSeconds / 60);
		var hours = Math.floor(mins/60);
		var days = Math.floor(hours/24);
		var years = Math.floor(days/365);
		
		var secs = Math.round(blackSeconds % 60);
		
		var output = "";

		if (years > 0) {
			output += years + ";";
		} 
		if (days % 365 > 0) {
			output += days % 365 + ":";
		} 
		if (hours % 24 > 0) {
			output += hours % 24 + ":";
		}
		if (mins % 60 > 0) {
			output += mins % 60 + ":";
		} else {
			output += 0 + ":";
		}
		
		if (secs < 10) {
			output += "0";
		}
		
		output += secs;

		var size = output.length;
		size -= 4;
		size = size * 15 + 80;
		timerBlack.style.width = size + "px"; 
		//timerBlack.style.marginLeft = 640 - size + "px";
			
		timerBlack.innerHTML = output;
		expected += interval;

		if (blackSeconds === 0) {
			blackPause = true;
			winner = "w";
		    gameOver = true;
			sound.winS();
			stopGame();
		}
		
		if (!blackPause && current == moveCount) {
    		setTimeout(blackStep, Math.max(0, interval - drift));
		}
	}
}