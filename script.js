const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');



/* ################ LINEAR ALGEBRA ################ */


class Matrix {
    constructor(...rows) {

        this.rows = [...rows];

        this.nRows = this.rows.length;
        this.nCols = this.rows[0].length;
    }

    multiply(x) {     
        if (x.rows.length != this.rows[0].length) throw Error("nah g ts aint gon work fr i aint paid enough for ts");

        const cols = x.rows[0].map((_, colIndex) => x.rows.map(row => row[colIndex]));


        let result = [];

        for (let [i, row] of this.rows.entries()) {
            result.push([]);
            for (let [j, col] of cols.entries()) {
                let sum = 0;
                for (let k=0; k<this.nCols; k++) {
                    sum += row[k] * col[k];
                }

                result[i][j] = sum;
            }
        }
        return new Matrix(
            ...result
        );
    }
    static translationMatrix(x, y, z) {
        let result = structuredClone(iMatrix.rows);

        result[0][3] = x;
        result[1][3] = y;
        result[2][3] = z;

        return new Matrix(...result);
    }
    static scalarMatrix(s) {
        let result = structuredClone(iMatrix.rows);
        
        result[0][0] = s;
        result[1][1] = s;
        result[2][2] = s;
        
        return new Matrix(...result);
    }
    static projectionMatrix(zDist) {
        let result = structuredClone(iMatrix.rows);
        result[3][2] = 1;
        result[3][3] = zDist;

        return new Matrix(...result);
    }
}
const iMatrix = new Matrix(
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
);

/* ################ Camera control ################ */

var cameraPosition = [0, 0, -5];
var cameraRotation = [0, 0, 0];

const zDist = 0;

/* ################ Canvas constants, and objects. ################ */


// Cartesian bounds
const minX = -1;
const minY = -1;
const maxX = 1;
const maxY = 1;

// Cartesian vertex and edge tables to render
const t = (1 + Math.sqrt(5)) / 2;

const vertices = [
    [ 0,  1,  t],  // 0
    [ 0,  1, -t],  // 1
    [ 0, -1,  t],  // 2
    [ 0, -1, -t],  // 3

    [ 1,  t,  0],  // 4
    [ 1, -t,  0],  // 5
    [-1,  t,  0],  // 6
    [-1, -t,  0],  // 7

    [ t,  0,  1],  // 8
    [ t,  0, -1],  // 9
    [-t,  0,  1],  // 10
    [-t,  0, -1]   // 11
];
const edges = [
    [0, 2], [0, 4], [0, 6], [0, 8], [0, 10],
    [1, 3], [1, 4], [1, 6], [1, 9], [1, 11],
    [2, 5], [2, 7], [2, 8], [2, 10],
    [3, 5], [3, 7], [3, 9], [3, 11],
    [4, 6], [4, 8], [4, 9],
    [5, 7], [5, 8], [5, 9],
    [6, 10], [6, 11],
    [7, 10], [7, 11],
    [8, 9], [10, 11]
];




// converts a vertex into homogenous coordinates, applying the model matrix to it
function homogenize(p) {
    return viewMatrix.multiply(modelMatrix.multiply(new Matrix(
        [p[0]],
        [p[1]],
        [p[2]],
        [1],
    )));
}
/* ################ CARTESIAN HELPERS ################ */

function rotate(p, i, j, angle) {
    
    const c = Math.cos(angle), s = Math.sin(angle);
    const a = p[i], b = p[j];
    const out = [...p];
    out[i] = a * c - b * s;
    out[j] = a * s + b * c;
    return out;
}


/* ################ CANVAS HELPERS ################ */

// Draws a line between raster coordinates
function line([x1, y1], [x2, y2]) {
    ctx.beginPath();
    
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    
    ctx.stroke();
}

// converts all vertices to homogenous coordinates
function homogenizeVertices() {
    return vertices.map(v => {
        return homogenize(v)
    })
}
function project(p) {
    let proj = Matrix.projectionMatrix(zDist).multiply(p);
    const result = proj.rows
    
    const z = result[3][0];
    return [
        result[0][0]/z,
        result[1][0]/z,
        result[2][0]/z,
    ]
}

// Converts from our localized coordinate system to raster coordinates for canvas
function rasterize(p) {
    let [x, y] = p;
    
    return [
        (x - minX) / (maxX - minX) * canvas.width,
        (maxY - y) / (maxY - minY) * canvas.height
    ]
}
function draw() {
    // Wipes the screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const translatedVertices = homogenizeVertices();
    
    // Draws a line for each edge in the constant table, using lookup in the vertices table
    edges.forEach((edge) => {
        
        
        const [p1, p2] = [project(translatedVertices[edge[0]]), project(translatedVertices[edge[1]])]
        
        
        const rastP1 = rasterize(p1);
        const rastP2 = rasterize(p2)
        line(
            rastP1,
            rastP2
        )
    })
}



/* ################ ANIMATION LOGIC ################ */

// Object specific matrices
var xRotation, yRotation, zRotation, rotationMatrix, modelMatrix;

// Camera specific matrices
var camXRotation, camYRotation, camZRotation, camRotationMatrix, viewMatrix;


var theta = 0;
var alpha = 0;

var camTheta = 0;
var camAlpha = 0;

function reCalculateObjectMatrices() {
    xRotation = new Matrix(
        [1,                0,           0, 0],
        [0, Math.cos(alpha), -Math.sin(alpha), 0],
        [0, Math.sin(alpha),  Math.cos(alpha), 0],
        [0,                0,           0, 1]
    )
    yRotation = new Matrix(
        [Math.cos(theta), 0, -Math.sin(theta), 0],
        [0,             1,  0,             0],
        [Math.sin(theta), 0,  Math.cos(theta), 0],
        [0,             0,  0,             1]
    )
    // zRotation = new Matrix(
        //     [Math.cos(rad), -Math.sin(rad), 0, 0],
        //     [Math.sin(rad),  Math.cos(rad), 0, 0],
        //     [0,              0,             1, 0],
        //     [0,              0,             0, 1]
        // )
        
        
    rotationMatrix = yRotation.multiply(xRotation)
    modelMatrix = Matrix.scalarMatrix(1).multiply(
        Matrix.translationMatrix(0, 0, 0).multiply(
            rotationMatrix
        )
    )
}
function reCalculateCameraMatrices() {
    camXRotation = new Matrix(
        [1,                0,           0, 0],
        [0, Math.cos(-camAlpha), -Math.sin(-camAlpha), 0],
        [0, Math.sin(-camAlpha),  Math.cos(-camAlpha), 0],
        [0,                0,           0, 1]
    )
    camYRotation = new Matrix(
        [Math.cos(-camTheta), 0, -Math.sin(-camTheta), 0],
        [0,             1,  0,             0],
        [Math.sin(-camTheta), 0,  Math.cos(-camTheta), 0],
        [0,             0,  0,             1]
    )
    // zRotation = new Matrix(
        //     [Math.cos(rad), -Math.sin(rad), 0, 0],
        //     [Math.sin(rad),  Math.cos(rad), 0, 0],
        //     [0,              0,             1, 0],
        //     [0,              0,             0, 1]
        // )
        
        
    camRotationMatrix = camYRotation.multiply(camXRotation)
    viewMatrix = camRotationMatrix.multiply(Matrix.translationMatrix(
        -cameraPosition[0],
        -cameraPosition[1],
        -cameraPosition[2],
    ))


}

function tick() {
    // theta += 0.01;
    // alpha -= 0.01;

    camTheta += .01;
    
    reCalculateObjectMatrices();
    reCalculateCameraMatrices();

    draw();
}
setInterval(tick, 10)








window.addEventListener('resize', resizeCanvas);
function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
  
    canvas.width = rect.width;
    canvas.height = rect.height;
  
    // Redraw your canvas content here
     draw();
}


