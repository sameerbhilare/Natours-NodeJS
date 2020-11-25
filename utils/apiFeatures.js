class APIFeatures {
  constructor(dbQuery, queryParamObj) {
    this.dbQuery = dbQuery;
    this.queryParamObj = queryParamObj;
  }

  filter() {
    /*******************************************************************/
    // 1A) FILTERING
    // creating a deep copy of the req.query object to avoid direct mutation on req.query object
    let queryObj = { ...this.queryParamObj };
    // exclude fields which are not related to filtering like - paging, sorting, limiting, selecting specific fields, etc.
    const excludeFields = ['page', 'sort', 'limit', 'fields'];
    // delete the 'excludedFields' from queryObj to that we will have only true 'filtering' criteria
    excludeFields.forEach((el) => delete queryObj[el]); // using delete operator

    /*******************************************************************/
    // 1B) ADVANCED FILTERING
    /* to support operators like less than, less than or equals, greater than, greater than or equals, etc.
    
    e.g. If we want say, difficulty = easy and duration greater than or equal to 5,
    MongoDB filter object should be -> { difficulty: "easy", duration: { $gte: 5 } } 
    
    If we use URL as ------->      /api/v1/tours?duration[gte]=5&difficulty=easy
    and log req.query, we get this  -> { difficulty: 'easy', duration: { gte: '5' } }
    which is same as 'MongoDB filter object' above. Just need to replace 'gte' with '$gte'.
    */

    // replace with actual operators by just prepending '$'
    let queryStr = JSON.stringify(queryObj); // convert JSON obj to string
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte)\b/g, (match) => `$${match}`);
    queryObj = JSON.parse(queryStr); // convert string to JSON object

    this.dbQuery = this.dbQuery.find(queryObj);

    return this; // return so that multiple functions can be chained together. (Fluent API)
  }

  sort() {
    /*******************************************************************/
    // 2) SORTING
    /*  e.g. 1
        URL To sort by price ascending ----> /api/v1/tours?sort=price
        Mongoose .sort() method should be ---> .sort('price')

        e.g. 2
        URL To sort by price descending ---> /api/v1/tours?sort=-price
        Mongoose .sort() method should be ---> .sort('-price')

        e.g. 3
        URL To sort by price asc and Avg ratings asc(if price is same) 
                ---> /api/v1/tours?sort=price,ratingsAverage
        Mongoose .sort() method should be ---> .sort('price ratingsAverage')

        e.g. 4
        URL To sort by price asc and Avg ratings desc(if price is same) 
                ---> /api/v1/tours?sort=price,-ratingsAverage
        Mongoose .sort() method should be ---> .sort('-price ratingsAverage')
    */
    if (this.queryParamObj.sort) {
      const sortBy = this.queryParamObj.sort.split(',').join(' '); // replace ',' by space
      this.dbQuery.sort(sortBy);
    } else {
      // for default sorting
      this.dbQuery.sort('-createdAt'); // sort of createdAt descending
    }

    return this; // return so that multiple functions can be chained together. (Fluent API)
  }

  limitFields() {
    /*******************************************************************/
    // 3) Field Limiting / Projection - allow clients to choose which fields they want to get in the response.
    /*
      For a client, it's always ideal to receive as little data as possible, in order to reduce the bandwidth
      that is consumed with each request. And that's especially true when we have really heavy data sets.

      e.g.
        To include only these fileds - name,duration,difficulty,price
        URL for field limiting ----> /api/v1/tours?fields=name,duration,difficulty,price
        Mongoose select() method would be ----> .select('name duration difficulty price'); // with space
      
        To 'exclude' a field, just use minus sign. 
        e.g. To exclude mongoose generated field called '__v' .select('-__v')

        To 'exclude' field like duration,difficulty
        URL for field limiting ----> /api/v1/tours?fields=-duration,-difficulty
        Mongoose select() method would be ----> .select('-duration -difficulty'); // with space

        Note: You CANNOT use both 'include' and 'exclude' in the same query.
        e.g. Something like this will FAIL --> /api/v1/tours?fields=name,-duration,-price 
    */
    if (this.queryParamObj.fields) {
      const fields = this.queryParamObj.fields.split(',').join(' ');
      this.dbQuery.select(fields);
    } else {
      // To exclude mongoose generated field
      this.dbQuery.select('-__v');
    }

    return this; // return so that multiple functions can be chained together. (Fluent API)
  }

  paginate() {
    /*******************************************************************/
    // 4) Pagination - allowing users to only select a certain page of our results, in case we have a lot of results.
    /*
        From user's point of view, he will send 2 parameters, page and limit.
        page - page number which he wants, limit - number of results in that page.
        e.g. URL for pagination ---> /api/v1/tours?page=2&limit=10

        Now it is our responsibility to do required calculations and provide only intended data
        e.g. for URL /api/v1/tours?page=2&limit=10,
             page = 2, limit = 10, so we want to skip 1-10 and pass 11-20 documents/rows
             page = 3, limit = 10, so we want to skip 1-20 and pass 21-30 documents/rows
             page = 2, limit = 5,  so we want to skip 1-5  and pass  6-10 documents/rows

        We should also define default page and limit parameters, if not passed by user, when we have huge data.
        Also when user request a page that does not exist, we should send an error.
     */
    // use 'page' value from queryparam or default as 1. * 1 is trick to convert string to number
    const page = this.queryParamObj.page * 1 || 1;
    // use 'limit' value from queryparam or default as 100. * 1 is trick to convert string to number
    const limit = this.queryParamObj.limit * 1 || 100;

    // calculate skip count becase we want to pass that to mongoose
    const skip = (page - 1) * limit;

    // skip the first 'skip' count and returns number of results as per 'limit'
    this.dbQuery = this.dbQuery.skip(skip).limit(limit);

    return this; // return so that multiple functions can be chained together. (Fluent API)
  }
}

module.exports = APIFeatures;
