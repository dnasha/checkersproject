// the vPos class stands for visual position
// it is responsible for aranging all of the initial pieces and
// tiles in order to display the checkerboard and initial
// positions of the checker pieces

class vPos {

	constructor (tiles, bTiles, wCheckers, bCheckers, wPieceCount, bPieceCount) {
		this.tiles = tiles;
		this.bTiles = bTiles;
		this.wCheckers = wCheckers;
		this.bCheckers = bCheckers;
		this.wPieceCount = wPieceCount;
		this.bPieceCount = bPieceCount;
	}


	// draws initial board environment 
	layoutBoard() {
		
		// aranges the locations of the tiles
		var leftPrev = 0;
		var topPrev = 0;

		for (var i = 0; i < 8; i ++) {
			for (var j = i * 8; j < i * 8 + 8; j ++) {
				
				tile = this.tiles.item(j);

				tile.style.left = leftPrev + "px";
				tile.style.top = topPrev + "px";

				leftPrev += 80;
			}

			leftPrev = 0;
			topPrev += 80;
		}
		

		// aranges the locations of the pieces
		for (var i = 0; i < this.bPieceCount; i ++) {
			var tile = this.bTiles.item(i);
			var bPiece = this.bCheckers.item(i);
			
			bPiece.style.left = tile.style.left;
			bPiece.style.top = tile.style.top;
		}

		for (var i = 0; i < this.wPieceCount; i ++) {
			var tile = this.bTiles.item(20 + i);
			var wPiece = this.wCheckers.item(i);

			wPiece.style.left = tile.style.left;
			wPiece.style.top = tile.style.top;
		}
	}
}
export {vPos}