const { Op, DataTypes } = require("sequelize");

function convertToQueryFilter(model, filter) {
    //strings will be "LIKE %value%", numbers will be _min and _max in filter object
    //check the sequelize model for the column type and convert the filter to the correct type
    const queryFilter = {};

    for (const key in filter) {
        if (filter[key] === undefined) {
            continue;
        }
        //remove _min and _max from key to check if it exists in the model
        const keyWithoutMinMax = key.replace(/_min|_max/g, "");
        const column = model.rawAttributes[keyWithoutMinMax];
        if (column === undefined) {
            continue;
        }
        if (column.type instanceof DataTypes.STRING) {
            queryFilter[key] = { [Op.iLike]: `%${filter[key]}%` };
        } else if (column.type instanceof DataTypes.INTEGER || column.type instanceof DataTypes.FLOAT) {
            if (filter[`${keyWithoutMinMax}_min`] !== undefined && filter[`${keyWithoutMinMax}_max`] !== undefined) {
                queryFilter[keyWithoutMinMax] = { [Op.between]: [filter[`${keyWithoutMinMax}_min`], filter[`${keyWithoutMinMax}_max`]] };
            } else if (filter[`${keyWithoutMinMax}_min`] !== undefined) {
                queryFilter[keyWithoutMinMax] = { [Op.gte]: filter[`${keyWithoutMinMax}_min`] };
            } else if (filter[`${keyWithoutMinMax}_max`] !== undefined) {
                queryFilter[keyWithoutMinMax] = { [Op.lte]: filter[`${keyWithoutMinMax}_max`] };
            } else {
                queryFilter[keyWithoutMinMax] = filter[key];
            }
        } else {
            queryFilter[key] = filter[key];
        }
    }

    return queryFilter;
}

function sanitizeFilter(filter) {
    //clone
    const sanitizedFilter = { ...filter };

    //remove limit and offset
    delete sanitizedFilter.limit;
    delete sanitizedFilter.offset;
    delete sanitizedFilter.order;
    delete sanitizedFilter.orderDirection;

    return sanitizedFilter;
}

function fixInputQuery(query){
    //convert all numeric strings to numbers
    for (const key in query) {
        if (query[key] === undefined) {
            continue;
        }
        if (!isNaN(query[key])) {
            query[key] = Number(query[key]);
        }
    }
    return query;
}

module.exports = {
    convertToQueryFilter,
    sanitizeFilter,
    fixInputQuery
};
