import { AI } from "./AI.js";
import { Checker } from "./checker.js";
import { checkerSound } from "./checkerSound.js";
import { Position } from "./fPos.js";
import { Move } from "./move.js";
import { PieceTracker } from "./pieceTracker.js";
import { vPos } from "./vPos.js";

// Developed by Dan Sharan

// the game script is the heart of the program
// it is what ties everything together and lets
// people play checkers against one another or
// an ai

// it is also in control of many other
// functions that can't be put in a class such as the
// timers

// it carries out both, the setup and play of the game

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

// started the game or not
var started = false;

// previous move
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

// visual position
var vp;

// variables relating to the forced attack rule
var forcedMoves = [];
var forced = false;

// ai
var ai;
var bot = false;
const botCondition = document.getElementById("botMode");

// timers
var whiteSeconds = 180;
var blackSeconds = 180;
//var whiteSeconds = 31536003;
//var blackSeconds = 31536003;

var timerWhite = document.getElementById("timerWhite");
var timerBlack = document.getElementById("timerBlack");

var whitePause = false;
var blackPause = false;

// ***************setup functions***************

// start - runs through other classes and functions
// to turn on audio, the visuals, click listeners,
// game logic, game loop, and so much more

window.onload = function start() {
	vp = new vPos(tiles, bTiles, wCheckers, bCheckers, wPieceCount, bPieceCount);
	vp.layoutBoard();

	content.style.visibility = "visible";

	for (let i = 0; i < checkers.length; i++) {
		checkers.item(i).style.visibility = "visible";
	}

	botCondition.addEventListener("click", () => {
		flipFlopAI();
	});

	populateArrays();
	clickListeners();

	posBoard = [
		[null, bcs[0], null, bcs[1], null, bcs[2], null, bcs[3]],

		[bcs[4], null, bcs[5], null, bcs[6], null, bcs[7], null],

		[null, bcs[8], null, bcs[9], null, bcs[10], null, bcs[11]],

		[null, null, null, null, null, null, null, null],

		[null, null, null, null, null, null, null, null],

		[wcs[0], null, wcs[1], null, wcs[2], null, wcs[3], null],

		[null, wcs[4], null, wcs[5], null, wcs[6], null, wcs[7]],

		[wcs[8], null, wcs[9], null, wcs[10], null, wcs[11], null],
	];

	basePosition = new Position(
		wcs,
		bcs,
		posBoard,
		wKingCount,
		bKingCount,
		wPieceCount,
		bPieceCount,
		moveCount,
		turn,
		prevMove,
	);

	ai = new AI(basePosition);
};

// this function determines whether the AI is on or not,
// based on the option checkbox
function flipFlopAI() {
	if (botCondition.checked) {
		bot = true;
		if (!turn) {
			ai.update(basePosition);
			setTimeout(() => {
				aiMove();
			}, 500);
		}
	} else {
		bot = false;
	}
}

// fills arrays of pieces with checker objects
function populateArrays() {
	var x = 1;
	var y = 0;

	for (var i = 1; i <= bPieceCount; i++) {
		bcs.push(new Checker([x, y], "B", bCheckers.item(i - 1), false, i - 1));

		if (i % 8 == 0) {
			x = 1;
		} else if (i % 4 == 0) {
			x = 0;
		} else {
			x += 2;
		}

		if (i % 4 == 0) {
			y++;
		}
	}

	x = 0;
	y = 5;

	for (var i = 1; i <= wPieceCount; i++) {
		wcs.push(new Checker([x, y], "W", wCheckers.item(i - 1), false, i - 1));

		if (i % 8 == 0) {
			x = 0;
		} else if (i % 4 == 0) {
			x = 1;
		} else {
			x += 2;
		}

		if (i % 4 == 0) {
			y++;
		}
	}
}

// adds click listeners to white pieces and all tiles
function clickListeners() {
	for (let i = 0; i < wPieceCount; i++) {
		var checker = wcs[i].source;
		checker.addEventListener("click", () => {
			clicked(wcs[i]);
		});
	}

	for (let i = 0; i < bTiles.length; i++) {
		var tile = bTiles.item(i);
		tile.addEventListener("click", () => {
			checkMove(bTiles.item(i), false);
		});
	}

	for (let i = 0; i < wTiles.length; i++) {
		var tile = wTiles.item(i);
		tile.addEventListener("click", () => {
			resetHeld();
		});
	}

	resetButton.addEventListener("click", () => {
		resetGame();
	});
	clickListenersBlack();
}

// adds click listeners to black pieces
function clickListenersBlack() {
	//if (!bot) {
	for (let i = 0; i < bPieceCount; i++) {
		var checker = bcs[i].source;
		checker.addEventListener("click", () => {
			clicked(bcs[i]);
		});
	}
	//}
}

// ***************logic functions***************

// if a checker is clicked
// then this function "activates it"
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

// activates a piece visually and sets it as the held piece
// also finds and displays indicators for possible moves for the activated
// piece
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
	playArea.style.cursor = "-webkit-grab";
	resetInds();
}

// checks to see if a move can be done
function checkMove(t) {
	var tX = Number.parseInt(t.style.left.replace("px", "")) / 80;
	var tY = Number.parseInt(t.style.top.replace("px", "")) / 80;

	var tempMove = new Move(held, [tX, tY], false);
	if (holding) {
		if (forced && forcedLaw.checked) {
			tempMove = new Move(held, [tX, tY], true);
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
	var start = Date.now();

	resetHeld();

	holding = true;

	ai.update(basePosition);

	var moveAI = ai.getMove();

	held = bcs[moveAI.piece.index];

	var attacking = moveAI.type;
	var cords = moveAI.cords;

	const mX = moveAI.cords[0];
	const mY = moveAI.cords[1];
	const pX = held.location[0];
	const pY = held.location[1];

	const tX = (pX + mX) / 2;
	const tY = (pY + mY) / 2;

	blackSeconds -= Math.ceil((Date.now() - start) / 1000);

	if (attacking) {
		attack(tX, tY);
	}
	move(cords);
	ai.update(basePosition);
}
// checks if a move is valid/legal
function isValidMove(move, piece, theory) {
	if (!holding) {
		return false;
	}

	var pX = piece.location[0];
	var pY = piece.location[1];

	var tX = move.cords[0];
	var tY = move.cords[1];

	if (0 > tX || tX > 7 || 0 > tY || tY > 7) {
		return false;
	}

	if (posBoard[tY][tX] != null) {
		return false;
	}

	if (
		Math.abs(tX - pX) == 2 &&
		Math.abs(tY - pY) == 2 &&
		checkAttack(tX, tY, pX, pY, theory)
	) {
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

	piece.source.style.left = newX * 80 + "px";
	piece.source.style.top = newY * 80 + "px";

	if (attackPlayed) {
		if (turn) {
			wTk.show();
		} else {
			bTk.show();
		}
		sound.attackS();
	} else {
		sound.moveS();
		forced = false;
	}

	posBoard[piece.location[1]][piece.location[0]] = null;
	posBoard[newY][newX] = piece;

	piece.location[0] = newX;
	piece.location[1] = newY;

	if (newY == 0 || newY == 7) {
		checkIfKing(piece);
		crowned = piece.king;
	}

	if (forced || (attackPlayed && turn == basePosition.prevMove.piece.type())) {
		forcedAttack();

		var temp = [];
		forced = false;
		for (let i = 0; i < forcedMoves.length; i++) {
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

	resetInds();
	indicate(held);

	if (!forced) {
		turnSwitch();
		resetHeld();
	} else {
		if (!turn && bot) {
			setTimeout(() => {
				aiMove();
			}, 500);
		}
	}

	attackPlayed = false;
}

// switches the turn of the game
function turnSwitch() {
	basePosition = new Position(
		wcs,
		bcs,
		posBoard,
		wKingCount,
		bKingCount,
		wPieceCount,
		bPieceCount,
		moveCount,
		turn,
		prevMove,
	);

	moveCount++;

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
			timerBlack.style.opacity = 0.4;
			timerWhite.style.opacity = 1;
			whitePause = false;
			blackPause = true;
			blackSeconds += 3;
		} else {
			timerBlack.style.opacity = 1;
			timerWhite.style.opacity = 0.4;
			whitePause = true;
			blackPause = false;
			whiteSeconds += 3;
		}

		timer(turn);

		basePosition = new Position(
			wcs,
			bcs,
			posBoard,
			wKingCount,
			bKingCount,
			wPieceCount,
			bPieceCount,
			moveCount,
			turn,
			prevMove,
		);

		if (!turn && bot) {
			ai.update(basePosition);
			setTimeout(() => {
				aiMove();
			}, 500);
		}
	}
}

// checks if a piece is a king now
// and appoints it if it is one
function checkIfKing(piece) {
	if (!piece.king) {
		if (piece.color === "W" && piece.location[1] == 0) {
			crownPiece(piece);
		} else if (piece.color === "B" && piece.location[1] == 7) {
			crownPiece(piece);
		}
	} else {
		if (piece.color === "W") {
			piece.source.style.backgroundImage =
				"radial-gradient(white, rgb(150, 150, 150), black)";
		} else {
			piece.source.style.backgroundImage =
				"radial-gradient(black, rgb(50, 50, 50), rgb(150, 150, 150))";
		}
	}
}

// turns a piece into a king visually and updates
// the king count for that side/player
function crownPiece(piece) {
	piece.king = true;
	if (piece.color === "B") {
		bKingCount++;
		piece.source.style.backgroundImage =
			"radial-gradient(black, rgb(50, 50, 50), rgb(150, 150, 150))";
	} else if (piece.color === "W") {
		wKingCount++;
		piece.source.style.backgroundImage =
			"radial-gradient(white, rgb(150, 150, 150), black)";
	}
}

// checks to see if an attack is legal
function checkAttack(tx, ty, px, py, theory) {
	var targetX = (tx + px) / 2;
	var targetY = (ty + py) / 2;

	if (posBoard[targetY][targetX] == null) {
		return false;
	}

	var type = posBoard[targetY][targetX].color;

	if (turn && type === "W") {
		return false;
	} else if (!turn && type === "B") {
		return false;
	}

	if (
		posBoard[py][px].king &&
		Math.abs(tx - px) == 2 &&
		Math.abs(ty - py) == 2
	) {
		if (posBoard[targetY][targetX] == null) {
			return false;
		}
		if (!theory) {
			return attack(targetX, targetY);
		} else {
			return true;
		}
	} else {
		if (turn && Math.abs(tx - px) == 2 && ty - py == -2) {
			if (posBoard[targetY][targetX] == null) {
				return false;
			}
			if (!theory) {
				return attack(targetX, targetY);
			} else {
				return true;
			}
		} else if (!turn && Math.abs(tx - px) == 2 && ty - py == 2) {
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

	if (turn && type === "W") {
		return false;
	} else if (!turn && type === "B") {
		return false;
	}

	piece.source.style.visibility = "hidden";
	piece.dead = true;

	attackPlayed = true;

	posBoard[tY][tX] = null;

	if (!turn) {
		wPieceCount--;
	} else {
		bPieceCount--;
	}

	return true;
}

// indicates possible moves visually
function indicate(moves) {
	var indicated = [];

	if (forced) {
		for (let i = 0; i < forcedMoves.length; i++) {
			if (held.equals(forcedMoves[i].piece)) {
				indicated.push(forcedMoves[i]);
			}
		}
	} else {
		indicated = moves;
	}

	for (let i = 0; i < indicated.length; i++) {
		var ind = inds.item(i);

		ind.style.left = indicated[i].cords[0] * 80 + "px";
		ind.style.top = indicated[i].cords[1] * 80 + "px";

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
		new Move(piece, [x + 1, y + 1], false),
		new Move(piece, [x + 1, y - 1], false),
		new Move(piece, [x - 1, y + 1], false),
		new Move(piece, [x - 1, y - 1], false),
		new Move(piece, [x + 2, y + 2], true),
		new Move(piece, [x + 2, y - 2], true),
		new Move(piece, [x - 2, y + 2], true),
		new Move(piece, [x - 2, y - 2], true),
	];

	for (let i = moves.length - 1; i >= 0; i--) {
		if (!isValidMove(moves[i], piece, true)) {
			moves.splice(i, 1);
		}
	}

	return moves;
}

// function that is practically a custom
// .contains function or .includes function for arrays
function hasMove(move) {
	for (let i = 0; i < forcedMoves.length; i++) {
		if (forcedMoves[i].equals(move)) {
			return true;
		}
	}
	return false;
}

// resets/hides move indicators
function resetInds() {
	for (let i = 0; i < inds.length; i++) {
		inds.item(i).style.visibility = "hidden";
	}
}

// checks if there is a winner
function checkWin() {
	var wms = allMovesPossible(true);
	var bms = allMovesPossible(false);

	var wmc = 0;
	var bmc = 0;

	for (var i = 0; i < wms.length; i++) {
		for (var j = 0; j < wms[i].length; j++) {
			wmc++;
		}
	}

	for (var i = 0; i < bms.length; i++) {
		for (var j = 0; j < bms[i].length; j++) {
			bmc++;
		}
	}

	if (wPieceCount == 0) {
		winner = "b";
		gameOver = true;
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

// stops the game fully
function stopGame() {
	whitePause = true;
	blackPause = true;

	if (winner === "w") {
		alert("white wins");
	}
	if (winner === "b") {
		alert("black wins");
	}

	resetButton.style.visibility = "visible";
}

// resets the game to its initial state
// if the player chooses to play again after they've won (or lost)
function resetGame() {
	resetHeld();

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

	posBoard = [
		[null, bcs[0], null, bcs[1], null, bcs[2], null, bcs[3]],

		[bcs[4], null, bcs[5], null, bcs[6], null, bcs[7], null],

		[null, bcs[8], null, bcs[9], null, bcs[10], null, bcs[11]],

		[null, null, null, null, null, null, null, null],

		[null, null, null, null, null, null, null, null],

		[wcs[0], null, wcs[1], null, wcs[2], null, wcs[3], null],

		[null, wcs[4], null, wcs[5], null, wcs[6], null, wcs[7]],

		[wcs[8], null, wcs[9], null, wcs[10], null, wcs[11], null],
	];

	for (let i = 0; i < 12; i++) {
		wCheckers.item(i).style.visibility = "visible";
		wCheckers.item(i).style.backgroundImage = "none";
		bCheckers.item(i).style.visibility = "visible";
		bCheckers.item(i).style.backgroundImage = "none";
	}

	basePosition = new Position(
		wcs,
		bcs,
		posBoard,
		wKingCount,
		bKingCount,
		wPieceCount,
		bPieceCount,
		moveCount,
		turn,
	);

	whiteSeconds = 180;
	blackSeconds = 180;
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

// gets all of the move possible for a side
// by combining all of the moves possible for each piece on that side
function allMovesPossible(side) {
	var prevTurn = turn;
	var allMoves = [];

	if (side) {
		turn = true;
		for (let i = 0; i < wcs.length; i++) {
			if (
				wcs[i].source.style.visibility === "visible" &&
				!possibleMoves(wcs[i]).length == 0
			) {
				allMoves.push(possibleMoves(wcs[i]));
			}
		}
	} else {
		turn = false;
		for (let i = 0; i < bcs.length; i++) {
			if (
				bcs[i].source.style.visibility === "visible" &&
				!possibleMoves(bcs[i]).length == 0
			) {
				allMoves.push(possibleMoves(bcs[i]));
			}
		}
	}

	turn = prevTurn;

	return allMoves;
}

// checks if there is a forced attack present within the current
// game position
function forcedAttack() {
	var moves;

	if (turn) {
		moves = allMovesPossible(true);
	} else {
		moves = allMovesPossible(false);
	}

	forcedMoves.length = 0;

	for (var i = 0; i < moves.length; i++) {
		for (var j = 0; j < moves[i].length; j++) {
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

// finds whether a specific piece is obligated/forced to attack
function forcedPiece(checker) {
	for (let i = 0; i < forcedMoves.length; i++) {
		if (forcedMoves[i].piece.equals(checker)) {
			return true;
		}
	}
	return false;
}

// as the name implies, this is obviously a timer
function timer(type) {
	var interval = 1000;
	var expected = Date.now() + interval;
	const current = moveCount;

	//https://stackoverflow.com/questions/29971898/how-to-create-an-accurate-timer-in-javascript
	if (type) {
		setTimeout(whiteStep, interval);
	} else {
		setTimeout(blackStep, interval);
	}

	// recursive count down function for the white side
	function whiteStep() {
		var drift = Date.now() - expected;

		if (drift > interval / 4) {
			drift = 0;
		}

		whiteSeconds--;

		if (whiteSeconds < 10) {
			timerWhite.style.color = "red";
		} else if (whiteSeconds > 10 && timerWhite.style.color === "red") {
			timerWhite.style.color = "black";
		}

		var mins = Math.floor(whiteSeconds / 60);
		var hours = Math.floor(mins / 60);
		var days = Math.floor(hours / 24);
		var years = Math.floor(days / 365);

		var secs = Math.round(whiteSeconds % 60);

		var output = "";

		// unit conversion
		if (years > 0) {
			output += years + ";";
		}
		if (days % 365 > 0) {
			output += (days % 365) + ":";
		}
		if (hours % 24 > 0) {
			output += (hours % 24) + ":";
		}
		if (mins % 60 > 0) {
			output += (mins % 60) + ":";
		} else {
			output += 0 + ":";
		}

		if (secs < 10) {
			output += "0";
		}

		output += secs;

		// visual truncation
		var size = output.length;
		size -= 4;
		size = size * 15 + 80;
		timerWhite.style.width = size + "px";

		timerWhite.innerHTML = output;
		expected += interval;

		//win condition
		if (whiteSeconds === 0) {
			whitePause = true;
			winner = "b";
			gameOver = true;
			sound.winS();
			stopGame();
		}

		// recursion break
		if (!whitePause && current == moveCount) {
			setTimeout(whiteStep, Math.max(0, interval - drift));
		}
	}

	// recursive count down function for the black side
	function blackStep() {
		var drift = Date.now() - expected;

		if (drift > interval / 4) {
			drift = 0;
		}

		blackSeconds--;

		if (blackSeconds < 10) {
			timerBlack.style.color = "red";
		} else if (blackSeconds > 10 && timerBlack.style.color === "red") {
			timerBlack.style.color = "white";
		}

		var mins = Math.floor(blackSeconds / 60);
		var hours = Math.floor(mins / 60);
		var days = Math.floor(hours / 24);
		var years = Math.floor(days / 365);

		var secs = Math.round(blackSeconds % 60);

		var output = "";

		// unit converter
		if (years > 0) {
			output += years + ";";
		}
		if (days % 365 > 0) {
			output += (days % 365) + ":";
		}
		if (hours % 24 > 0) {
			output += (hours % 24) + ":";
		}
		if (mins % 60 > 0) {
			output += (mins % 60) + ":";
		} else {
			output += 0 + ":";
		}

		if (secs < 10) {
			output += "0";
		}

		output += secs;

		// visual truncation
		var size = output.length;
		size -= 4;
		size = size * 15 + 80;
		timerBlack.style.width = size + "px";

		timerBlack.innerHTML = output;
		expected += interval;

		// win condition
		if (blackSeconds === 0) {
			blackPause = true;
			winner = "w";
			gameOver = true;
			sound.winS();
			stopGame();
		}

		// recursion break
		if (!blackPause && current == moveCount) {
			setTimeout(blackStep, Math.max(0, interval - drift));
		}
	}
}
