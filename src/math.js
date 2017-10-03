
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
    
    //support expressions without Math. as suffix.
    formula = formula.replace(/(sin\(|cos\(|tan\(|log\(|max\(|min\(|abs\(|sinh\(|cosh\(|tanh\(|acos\(|asin\(|atan\(|exp\(|sqrt\()/g,"Math.$1")


    //factorial
    let formulafac = formula.split("!")
    if(formulafac.length == 2)
    {
        //  ( a ( b ( c ) ) ^ ( d ( e ) ) )
        //      0   1   2 1 | 1   2   1 0
        //          left        right

        //left, start at the end of the string:
        let left = 0
        let j = formulafac[0].length-1
        do
        {
            if(formulafac[0][j] == ")")
                left ++
            else if(formulafac[0][j] == "(")
                left --
            j--
        } while(j > 0 && left > 0)


        //check if there is an expression to the left of the leftmost bracket
        //f(foo)^2 or Math.sin(bar)^2
        //the regex max also check for dots (Math.bla()), when there is a dot before the brackets it's invalid syntax anyway
        if(/[A-Za-z0-9_\.]/g.test(formulafac[0][j-1]))
        {
            //take that expression into account
            while(j > 0 && /[A-Za-z0-9_\.]/g.test(formulafac[0][j-1]))
                j--
        }


        //now take j and create the substring that contains the part to be factorialized
        let leftExpr = formulafac[0].substring(j,formulafac[0].length)
        //cut it away from formulapow
        let cutl = formulafac[0].substring(0,j)

        //create formula with proper factorial expressions:
        formula = cutl+"Math2.factorial("+leftExpr+")"+formulafac[1]
    }


    //pow
    let formulapow = formula.split("^")
    if(formulapow.length == 2)
    {
        //  ( a ( b ( c ) ) ^ ( d ( e ) ) )
        //      0   1   2 1 | 1   2   1 0
        //          left        right

        //left, start at the end of the string:
        let left = 0
        let j = formulapow[0].length-1
        do
        {
            if(formulapow[0][j] == ")")
                left ++
            else if(formulapow[0][j] == "(")
                left --
            j--
        } while(j > 0 && left > 0)


        //right, start at the beginning of the string:
        let right = 0
        let k = 0
        do
        {
            if(formulapow[1][k] == ")")
                right --
            else if(formulapow[1][k] == "(")
                right ++
            k++
        } while(k < formulapow[1].length && right > 0)


        //check if there is an expression to the left of the leftmost bracket
        //f(foo)^2 or Math.sin(bar)^2
        //the regex max also check for dots (Math.bla()), when there is a dot before the brackets it's invalid syntax anyway
        if(/[A-Za-z0-9_\.!]/g.test(formulapow[0][j-1]))
        {
            //take that expression into account
            while(j > 0 && /[A-Za-z0-9_\.!]/g.test(formulapow[0][j-1]))
                j--
        }


        //now take j and k and create substrings
        let leftExpr = formulapow[0].substring(j,formulapow[0].length)
        let rightExpr = formulapow[1].substring(0,k)
        
        //cut it away from formulapow
        let cutl = formulapow[0].substring(0,j)
        let cutr = formulapow[1].substring(k,formulapow[1].length)

        //create formula with proper Math.pow expressions:
        formula = cutl+"Math.pow("+leftExpr+","+rightExpr+")"+cutr
    }

    //Math.Math. could be there a few times at this point. clear that
    formula = formula.replace("Math.Math.","Math.")
    
    console.log("parsed formula: "+formula)

    return formula
}