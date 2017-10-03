
/**
 * thanks to https://stackoverflow.com/questions/15454183/how-to-make-a-function-that-computes-the-factorial-for-numbers-with-decimals
 * 
 * @param z     number to Calculate the gamma of 
 */
export function gamma(z) {

    let g = 7
    let C = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 
        771.32342877765313, -176.61502916214059, 12.507343278686905, 
        -0.13857109526572012, 9.9843695780195716 * Math.pow(10, -6), 
        1.5056327351493116 * Math.pow(10, -7)
    ]

    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z))
    else {
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
 * 
 * @param x     number to Calculate the factorial of "x!"" 
 */
export function factorial(x)
{
    return gamma(x+1)
}



/**
 * helper to be able to replace ln with the logarithm
 * 
 * @param a     x
 * @param b     base 
 */
export function log2(a,b)
{
    return Math.log(b,a)
}



/**
 * converts mathematical formulas to javascript syntax
 * 
 * @param formula       string of a formula that contains !, ^, sin, cos, etc. expressions 
 * 
 * @return              javascript compatible function in a string that can be executed using eval(string)
 */
export function parse(formula)
{
    //regex for numbers of x1 and x2: (x1|x2|\d+(\.\d+){0,1})
    
    //remove whitespaces for easier regex replaces
    formula = formula.replace(/\s+/g,"")

    //support mathematical constants
    formula = formula.replace(/(pi|PI|Pi|π)/g,"Math.PI")
    formula = formula.replace(/(e|E)/g,"Math.E")

    //support ln()
    formula = formula.replace(/ln\(/g,"Math2.log2(Math.E,")

    //support powers (WHAAT browsers support this? Testet with firefox and chromium-browser)
    formula = formula.replace("^","**")
    
    //support expressions without Math. as suffix.
    formula = formula.replace(/(sin\(|cos\(|tan\(|log\(|max\(|min\(|abs\(|sinh\(|cosh\(|tanh\(|acos\(|asin\(|atan\(|exp\(|sqrt\()/g,"Math.$1")


    //factorial
    while(true)
    {
        let formulafac = formula.split(/!(.*)/g)
        //console.log("in: "+formula)
        //console.log(formulafac)
        if(formula.indexOf("!") != -1) //if threre is a factorial
        {
            //  ( a ( b ( c ) ) ! foobar
            //      0   1   2 1 | 
            //          left    | right


            //left, start at the end of the string:
            let left = 0
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


            //check if there is an expression to the left of the leftmost bracket
            //also check if there is an expression instead of a bracket
            //f(foo)^2 or Math.sin(bar)^2
            //the regex max also check for dots (Math.bla()), when there is a dot before the brackets it's invalid syntax anyway
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
            formula = cutl+"Math2.factorial("+leftExpr+")"+formulafac[1]
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
    formula = formula.replace("Math.Math.","Math.")
    
    //console.log("final parsed formula: "+formula)

    return formula
}