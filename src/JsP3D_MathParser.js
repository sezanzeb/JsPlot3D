//converts mathematical syntax to javascript.

/**
 * @private
 */
export default class JsP3D_MathParser
{
    /**
     * this is the constructor for the class called "JsP3D_MathParser" which is used to handle calculations.
     * There is nothing api relevant here
     * @param {object} parent instance of JsPlot3D 
     */
    constructor(parent)
    {
        this.parent = parent
        this.resetCalculation() // configures the variables
    }

    /**
     * runs eval
     * @param {Number} x1 first parameter of f(x1,x3) (x)
     * @param {Number} x3 second parameter of f(x1,x3) (z)
     */
    eval2(x1, x3)
    {
        //this.x1 and this.x3 are going to be used during the eval process
        this.x1 = x1
        this.x3 = x3
        this.xRes = this.parent.dimensions.xRes
        this.zRes = this.parent.dimensions.zRes
        let y = eval(this.parsedFormula)
        return y
    }

    


    /**
     * helper for f(x1,x3) in case there is recursion
     * @private
     * @param {number} x1        x1 value in the coordinate system
     * @param {number} x3        x3 value in the coordinate system
     */
    frec(x1, x3)
    {
        let x1index = (x1*this.xRes)|0
        let x3index = (x3*this.zRes)|0

        if(x1 < 0 || x3 < 0 || x1 >= this.parent.xLen || x3 >= this.parent.zLen)
            return 0

        // checking for a point if it has been calculated already increases the performance and
        // reduces the number of recursions.

        let val = this.calculatedPoints[x1index]
        if(val !== undefined)
            val = val[x3index]

        if(val === undefined)
            return

        if(val === undefined) // has this point has already been calculated before?
        {
            if(!this.stopRecursion)
                // bind f it to this, so that it can access this.calculatedPoints, this.xLen and this.zLen, this.stopRecursion
                // another solution would be probably if I would just hand the variables over to MathParser
                val = this.eval2(this.parsedFormula, x1, x3, this.frec.bind(this))

            this.calculatedPoints[x1index][x3index] = val
        }

        // val might return NaN for Math.sqrt(-1)
        // that's fine. Handle this case in the loops that plot the function

        return val
    }



    /**
     * function that is used when calculating the x3 values f(x1, x3)
     * @private
     * @param {number} x1        x1 value in the coordinate system
     * @param {number} x3        x3 value in the coordinate system
     */
    f(x1, x3)
    {
        return this.eval2(x1, x3)
    }



    /**
     * reinitializes the variables that are needed for calculating plots, so that a new plot can be started
     * @private
     */
    resetCalculation()
    {
        this.calculatedPoints = new Array(this.parent.dimensions.xVerticesCount)
        for(let i = 0;i < this.calculatedPoints.length; i++)
            this.calculatedPoints[i] = new Float32Array(this.parent.dimensions.zVerticesCount)

        this.parsedFormula = ""
        this.stopRecursion = false
    }



    /**
     * thanks to https://stackoverflow.com/questions/15454183/how-to-make-a-function-that-computes-the-factorial-for-numbers-with-decimals
     * @param z     number to Calculate the gamma of 
     */
    gamma(z)
    {
        let g = 7
        let C = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 
            771.32342877765313, -176.61502916214059, 12.507343278686905, 
            -0.13857109526572012, 9.9843695780195716 * Math.pow(10, -6), 
            1.5056327351493116 * Math.pow(10, -7)
        ]

        if (z < 0.5)
            return Math.PI / (Math.sin(Math.PI * z) * this.gamma(1 - z))
        else
        {
            z -= 1

            let x = C[0]
            for (let i = 1; i < g + 2; i++)
                x += C[i] / (z + i)

            let t = z + g + 0.5
            return Math.sqrt(2 * Math.PI) * Math.pow(t, (z + 0.5)) * Math.exp(-t) * x
        }
    }



    /**
     * Calculates a factorial
     * @param x     number to Calculate the factorial of "x!"" 
     */
    factorial(x)
    {
        return this.gamma(x+1)
    }



    /**
     * converts mathematical formulas to javascript syntax
     * @param formula       string of a formula that contains !, ^, sin, cos, etc. expressions 
     * @return              javascript compatible function in a string that can be executed using eval(string)
     */
    parse(formula)
    {
        //regex for numbers of x1 and x3: (x1|x3|\d+(\.\d+){0,1})
        
        formula = formula.toLowerCase()
        
        //remove whitespaces for easier regex replaces
        formula = formula.replace(/\s+/g,"")


        // MATHEMATICAL CONSTANTS
        // make sure that e.g. the e from exp doesn't get replaced with Math.E
        // going to need some way to indicate the start and end. add some string literals
        formula += "\0"
        formula = "\0" + formula
        formula = formula.replace(/([\^+-/*\(\0]+)(pi|PI|Pi|π)([\^+-/*\)\0]+)/g,"$1Math.PI$3")
        formula = formula.replace(/([\^+-/*\(\0]+)(e|E)([\^+-/*\)\0]+)/g,"$1Math.E$3")
        formula = formula.replace(/\0/g,"")

        
        formula = formula.replace(/math\./g,"Math.")

        //for recursive calls, make sure that the proper recursive handler is selected
        formula = formula.replace(/f\(/g,"this.frec(")
        if(formula.indexOf("frec") !== -1)
            console.warn("recursive formulas are not yet supported")

        //x1 and x3 are attributes of this class once eval2 gets called
        formula = formula.replace(/x1/g,"this.x1")
        formula = formula.replace(/x3/g,"this.x3")

        //support powers (to my susprise, current browsers support this (ES7 feature). Testet with firefox and chromium-browser)
        formula = formula.replace(/\^/g,"**")
        
        //support expressions without Math. as suffix.
        formula = formula.replace(/(sin\(|cos\(|tan\(|log\(|max\(|min\(|abs\(|sinh\(|cosh\(|tanh\(|acos\(|asin\(|atan\(|exp\(|sqrt\()/g,"Math.$1")

        //support ln()
        formula = formula.replace(/ln\(/g,"Math.log(")


        //factorial
        while(true)
        {
            //split the formula into the part left of the factorial and the part to the right
            let formulafac = formula.split(/!(.*)/g)
            //console.log("in: "+formula)
            //console.log(formulafac)

            if(formula.indexOf("!") != -1) //if threre is a factorial
            {
                //  ( a ( b ( c ) ) ! foobar
                //      0   1   2 1 | 
                //          left    | right


                let left = 0 //counts brackets to the left
                // start at the end of the string:
                let j = formulafac[0].length-1
                if(formulafac[0][j] == ")") //if there is a bracket
                    do //find the opening bracket for this closing bracket
                    {
                        if(formulafac[0][j] == ")")
                            left ++
                        else if(formulafac[0][j] == "(")
                            left --
                        j--
                    } while(j > 0 && left > 0)
                else
                {
                    //console.log("no bracket to the left")
                }
                //the variable j will be 1 lower than the actual index of the opening bracket
                j++
                //console.log("opening bracket on index "+j)


                //check if there is an expression to the left
                //f(foo)! or Math.sin(bar)!
                //the regex may also check for dots (Math.bla()), when there is a dot before the brackets it's invalid syntax anyway
                if(/[A-Za-z0-9_\.]/g.test(formulafac[0][j-1]))
                {
                    //console.log("found expression")
                    //take that expression into account
                    //check if there is going to be another character for that expression one step to the left
                    while(j > 0 && /[A-Za-z0-9_\.]/g.test(formulafac[0][j-1]))
                        j-- //if yes, decrease the index j and check again
                }


                //now take j and create the substring that contains the part to be factorialized
                let leftExpr = formulafac[0].substring(j,formulafac[0].length)
                //console.log("to be factorized: "+leftExpr)
                //cut it away from formulapow
                let cutl = formulafac[0].substring(0,j)

                //create formula with proper factorial expressions:
                formula = cutl+"this.factorial("+leftExpr+")"+formulafac[1]
                //console.log("out "+formula)
                //console.log("")
            }
            else
            {
                //console.log("no factorial detected")
                //console.log("")
                break
            }
        }


        //Math.Math. could be there a few times at this point. clear that
        formula = formula.replace(/(Math\.)+/g,"Math.")
        formula = formula.replace(/(this\.)+/g,"this.") //in case there are two this.

        this.parsedFormula = formula
        return formula
    }

}