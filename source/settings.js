// this script is responsible for the behavior of the menu
// that lets players change the visual theme of the game/page

const cog = document.getElementById("cog");
const menu = document.getElementById("menu");
const elsewhere = document.getElementById("content");
const body = document.getElementById("everything");
const title = document.getElementById("title");
const blackTile = document.getElementsByClassName("black_square");
const whiteTile = document.getElementsByClassName("white_square");
const blackChecker = document.getElementsByClassName("black_checker");
const whiteChecker = document.getElementsByClassName("white_checker");

let displayed = false;

const black = document.getElementById("dark");
const white = document.getElementById("light");
const def = document.getElementById("default");
const classic = document.getElementById("classic");
const ice = document.getElementById("ice");
const beach = document.getElementById("beach");
const forest = document.getElementById("forest");
const pink = document.getElementById("pink");
const ua = document.getElementById("ukraine");

// click listeners
cog.addEventListener("click", () => {
	flipFlopShow();
});
elsewhere.addEventListener("click", () => {
	displayed = true;
	flipFlopShow();
});

black.addEventListener("click", () => {
	dark();
});
def.addEventListener("click", () => {
	reset();
});
white.addEventListener("click", () => {
	light();
});
classic.addEventListener("click", () => {
	classy();
});
ice.addEventListener("click", () => {
	icy();
});
beach.addEventListener("click", () => {
	beachy();
});
forest.addEventListener("click", () => {
	foresty();
});
pink.addEventListener("click", () => {
	pinky();
});
ua.addEventListener("click", () => {
	ukraine();
});

// controlls the visibility of the menu
function flipFlopShow() {
	if (displayed) {
		displayed = false;
		menu.style.visibility = "hidden";
	} else {
		displayed = true;
		menu.style.visibility = "visible";
	}
}

// every function from this point on just
// changes style values of elements to
// effectively change the visual theme of the page

function dark() {
	body.style.backgroundColor = "rgb(47, 46, 46)";
}

function light() {
	body.style.backgroundColor = "rgb(230, 230, 230)";
}

function reset() {
	body.style.backgroundColor = "rgb(47, 46, 46)";

	for (let i = 0; i < 32; i++) {
		whiteTile.item(i).style.backgroundColor = "rgb(235, 236, 208)";
		blackTile.item(i).style.backgroundColor = "rgb(72, 46, 39)";
	}
	for (let i = 0; i < 12; i++) {
		whiteChecker.item(i).style.backgroundColor = "rgb(252, 251, 251)";
		blackChecker.item(i).style.backgroundColor = "rgb(1, 11, 2)";

		if (whiteChecker.item(i).style.backgroundImage != "") {
			whiteChecker.item(i).style.backgroundImage =
				"radial-gradient(white, rgb(150, 150, 150), black)";
		}
		if (blackChecker.item(i).style.backgroundImage != "") {
			blackChecker.item(i).style.backgroundImage =
				"radial-gradient(black, rgb(50, 50, 50), rgb(150, 150, 150))";
		}
	}

	title.style.color = "rgb(235, 236, 208)";
	title.style.textShadow = "5px 5px 3px rgb(72, 46, 39)";
}

function classy() {
	for (let i = 0; i < 32; i++) {
		whiteTile.item(i).style.backgroundColor = "rgb(240, 240, 240)";
		blackTile.item(i).style.backgroundColor = "rgb(10, 10, 10)";
	}
	for (let i = 0; i < 12; i++) {
		whiteChecker.item(i).style.backgroundColor = "rgb(255, 255, 255)";
		blackChecker.item(i).style.backgroundColor = "rgb(163, 0, 0)";

		if (whiteChecker.item(i).style.backgroundImage != "") {
			whiteChecker.item(i).style.backgroundImage =
				"radial-gradient(white, rgb(150, 150, 150), black)";
		}
		if (blackChecker.item(i).style.backgroundImage != "") {
			blackChecker.item(i).style.backgroundImage =
				"radial-gradient(rgb(163, 0, 0), black)";
		}
	}

	title.style.color = "rgb(250, 250, 250)";
	title.style.textShadow = "5px 5px 3px rgb(163, 0, 0)";
}

function icy() {
	for (let i = 0; i < 32; i++) {
		whiteTile.item(i).style.backgroundColor = "rgb(240, 240, 240)";
		blackTile.item(i).style.backgroundColor = "rgb(63, 126, 179)";
	}

	for (let i = 0; i < 12; i++) {
		whiteChecker.item(i).style.backgroundColor = "rgb(255, 255, 255)";
		blackChecker.item(i).style.backgroundColor = "rgb(0, 71, 171)";

		if (whiteChecker.item(i).style.backgroundImage != "") {
			whiteChecker.item(i).style.backgroundImage =
				"radial-gradient(rgb(255, 255, 255), rgb(150, 150, 150))";
		}
		if (blackChecker.item(i).style.backgroundImage != "") {
			blackChecker.item(i).style.backgroundImage =
				"radial-gradient(rgb(0, 71, 171), rgb(50, 50, 50))";
		}
	}

	title.style.color = "rgb(250, 250, 250)";
	title.style.textShadow = "5px 5px 3px rgb(63, 126, 179)";
}

function beachy() {
	for (let i = 0; i < 32; i++) {
		whiteTile.item(i).style.backgroundColor = "rgb(249, 209, 153)";
		blackTile.item(i).style.backgroundColor = "rgb(146, 196, 238)";
	}

	for (let i = 0; i < 12; i++) {
		whiteChecker.item(i).style.backgroundColor = "rgb(246, 227, 212)";
		blackChecker.item(i).style.backgroundColor = "rgb(100, 171, 227)";

		if (whiteChecker.item(i).style.backgroundImage != "") {
			whiteChecker.item(i).style.backgroundImage =
				"radial-gradient(rgb(246, 227, 212), rgb(150, 150, 150))";
		}
		if (blackChecker.item(i).style.backgroundImage != "") {
			blackChecker.item(i).style.backgroundImage =
				"radial-gradient(rgb(100, 171, 227), rgb(50, 50, 50))";
		}
	}

	title.style.color = "rgb(250, 250, 250)";
	title.style.textShadow = "5px 5px 3px rgb(199, 159, 103)";
}

function foresty() {
	for (let i = 0; i < 32; i++) {
		whiteTile.item(i).style.backgroundColor = "rgb(129,140,60)";
		blackTile.item(i).style.backgroundColor = "rgb(37,89,31)";
	}

	for (let i = 0; i < 12; i++) {
		whiteChecker.item(i).style.backgroundColor = "rgb(200, 255, 200)";
		blackChecker.item(i).style.backgroundColor = "rgb(25,39,13)";

		if (whiteChecker.item(i).style.backgroundImage != "") {
			whiteChecker.item(i).style.backgroundImage =
				"radial-gradient(rgb(200, 255, 200), rgb(150, 150, 150))";
		}
		if (blackChecker.item(i).style.backgroundImage != "") {
			blackChecker.item(i).style.backgroundImage =
				"radial-gradient(rgb(25,39,13), rgb(150, 150, 150))";
		}
	}

	title.style.color = "rgb(200, 255, 200)";
	title.style.textShadow = "5px 5px 3px rgb(37,89,31)";
}

function pinky() {
	for (let i = 0; i < 32; i++) {
		whiteTile.item(i).style.backgroundColor = "rgb(255, 153, 204)";
		blackTile.item(i).style.backgroundColor = "rgb(244, 125, 187)";
	}

	for (let i = 0; i < 12; i++) {
		whiteChecker.item(i).style.backgroundColor = "rgb(255, 182, 213)";
		blackChecker.item(i).style.backgroundColor = "rgb(217, 68, 150)";

		if (whiteChecker.item(i).style.backgroundImage != "") {
			whiteChecker.item(i).style.backgroundImage =
				"radial-gradient(rgb(255, 182, 213), rgb(150, 150, 150))";
		}
		if (blackChecker.item(i).style.backgroundImage != "") {
			blackChecker.item(i).style.backgroundImage =
				"radial-gradient(rgb(217, 68, 150), rgb(50, 50, 50))";
		}
	}

	title.style.color = "rgb(255, 153, 204)";
	title.style.textShadow = "5px 5px 3px rgb(217, 68, 150)";
}

function ukraine() {
	for (let i = 0; i < 32; i++) {
		whiteTile.item(i).style.backgroundColor = "rgb(255,255,160)";
		blackTile.item(i).style.backgroundColor = "rgb(0 91 187)";
	}

	for (let i = 0; i < 12; i++) {
		whiteChecker.item(i).style.backgroundColor = "rgb(255, 213, 0)";
		blackChecker.item(i).style.backgroundColor = "rgb(0,6,177)";

		if (whiteChecker.item(i).style.backgroundImage != "") {
			whiteChecker.item(i).style.backgroundImage =
				"radial-gradient(rgb(255, 213, 0), rgb(150, 150, 150))";
		}
		if (blackChecker.item(i).style.backgroundImage != "") {
			blackChecker.item(i).style.backgroundImage =
				"radial-gradient(rgb(0,6,177), rgb(50, 50, 50))";
		}
	}

	title.style.color = "rgb(255, 255, 160)";
	title.style.textShadow = "5px 5px 3px rgb(0 91 187)";
}
