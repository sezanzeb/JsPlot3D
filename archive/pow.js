    //don't need this because there is a pow operator **
    
    //pow
    let formulapow = formula.split("^")
    console.log(formulapow)
    if(formulapow.length == 2)
    {
        //  ( a ( b ( c ) ) ^ ( d ( e ) ) )
        //      0   1   2 1 | 1   2   1 0
        //          left    |   right


        //detect the opening bracket position for the ()^() formula
        //left, start at the end of the string:
        let left = 0
        let leftBracketCounter = 0 //counts both ( and )
        let j = formulapow[0].length-1
        do
        {
            if(formulapow[0][j] == ")") {
                left ++; leftBracketCounter++ }
            else if(formulapow[0][j] == "(") {
                left --; leftBracketCounter++ }
            j--
            //no bracket found? left remains 0, while loop will not continue
        } while(j > 0 && left > 0)

        //no bracket to the left? look for the expression (variable or number) to the left
        if(formulapow[0][formulapow[0].length-1] != ")")
        {
            j = formulapow[0].length-1
            while(j > 0 && /[a-zA-Z0-9\._]/g.test(formulapow[0][j]))
                j--
            //decrease the poistion index j as long as there is still an expression ongoing
            //will not complaint about e.g. ab1_23cd^2, because it could be a variable name
        }
        else //bracket found
        {
            //check if there is an expression to the left of the leftmost bracket
            //f(foo)^2 or Math.sin(bar)^2
            //the regex max also check for dots (Math.bla()), when there is a dot before the brackets it's invalid syntax anyway
            if(/[A-Za-z0-9_\.!]/g.test(formulapow[0][j-1]))
            {
                //take that expression into account
                while(j > 0 && /[A-Za-z0-9_\.!]/g.test(formulapow[0][j-1]))
                    j--
            }
        }


        //detect the closing bracket position for the ()^() formula
        //right, start at the beginning of the string:
        let right = 0
        let rightBracketCounter = 0 //counts both ( and )
        let k = 0
        do
        {
            if(formulapow[1][k] == ")") {
                right --; rightBracketCounter++ }
            else if(formulapow[1][k] == "(") {
                right ++; rightBracketCounter++ }
            k++
            //no bracket found? right remains 0, while loop will not continue
        } while(k < formulapow[1].length && right > 0)

        //no bracket to the right? look for the expression (variable or number) to the right
        if(formulapow[0][formulapow[0].length-1] != ")")
        {
            k = 0
            while(k < formulapow[1].length && /[a-zA-Z0-9\._]/g.test(formulapow[1][k]))
                k++
            //increase the poistion index k as long as there is still an expression ongoing
            //will not complaint about e.g. 2^ab1_23cd, because it could be a variable name
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