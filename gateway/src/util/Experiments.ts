// Code from https://gitlab.com/derpystuff/discord-experiments/-/blob/main/index.js
//@ts-nocheck

import murmurhash from "murmurhash";

export function encodeGuildExperiment(experiment){
    let encodedExperiment = [experiment.hashKey, null, experiment.revision] //Default config
    if(experiment.populations){ //Parse Populations
      let parsedPopulations = [];
      experiment.populations.forEach(function(population){
        let parsedPopulation = [];
        let parsedBuckets = [];
        Object.keys(population.buckets).forEach(function(bucketId){ //Parse Bucket
          let parsedBucket = [];
          let bucket = population.buckets[bucketId]
          parsedBucket.push(parseInt(bucketId))
          let rollouts = [];
          bucket.rollout.forEach(function(rollout){ //Apply rollouts to this bucket
            rollouts.push({
              s: rollout.min,
              e: rollout.max
            })
          })
          parsedBucket.push(rollouts)
          parsedBuckets.push(parsedBucket)
        })
        parsedPopulation.push(parsedBuckets)
        let parsedFilters = [];
        population.filters.forEach(function(filter){ //Parse filters
          let parsedFilter = [];
          //special case
          if(filter.type == "unknown_filter"){
            parsedFilter = [filter.hash, filter.data]
          } else {
            parsedFilter = [murmurhash.v3(filter.type.toLowerCase())]
            let filterData = [];
            //get the keys
            if(filter.guild_features){ // guild_has_feature
              filterData.push([murmurhash.v3("guild_features"), filter.guild_features])
            } else if(filter.min_id || filter.max_id){ //guild_id_range guild_member_count_range
              filterData.push([murmurhash.v3("min_id"), filter.min_id])
              filterData.push([murmurhash.v3("max_id"), filter.max_id])
            } else if(filter.ids){ //guild_ids
              filterData.push([murmurhash.v3("guild_ids"), filter.ids])
            }
            parsedFilter.push(filterData)
          }
          parsedFilters.push(parsedFilter)
        })
        parsedPopulation.push(parsedFilters)
        parsedPopulations.push(parsedPopulation)
      })
      encodedExperiment.push(parsedPopulations)
      let parsedOverrides = [];
      Object.keys(experiment.overrides).forEach(function(override){ //Parse Overrides
        parsedOverrides.push({b: parseInt(override), k: experiment.overrides[override]})
      })
      encodedExperiment.push(parsedOverrides)
      return encodedExperiment;
    }
  }
  
  export function decodeGuildExperiment(experiment){ //Decodes Experiments
    let parsedExperiment = {hashKey: experiment[0], revision: experiment[2], populations:[]};
    let parsedPopulations = []
    experiment[3].forEach(function(population){
      let parsedBuckets = {};
      population[0].forEach(function(bucket){ //Parse Buckets and Filters
        parsedBuckets[bucket[0].toString()] = {rollout:[]}
        bucket[1].forEach(function(rollout){
          parsedBuckets[bucket[0].toString()].rollout.push({min: rollout.s, max: rollout.e})
        })
      })
      let parsedFilters = []
      population[1].forEach(function(filter){
        //Filters we know
        switch(filter[0]){
          case 1604612045: //guild_has_feature
            parse = {
              type: "guild_has_feature"
            }
            filter[1].forEach(function(filterData){
              if(filterData[0] == 1183251248){ //guild_features
                parse.guild_features = filterData[1]
              } else {
                console.log('[EXPERIMENT] Expected guild_features, got ' + filterData)
              }
            })
            parsedFilters.push(parse)
            break;
          case 3013771838: //guild_ids
            parse = {
              type: "guild_ids"
            }
            filter[1].forEach(function(filterData){
              if(filterData[0] == 3013771838){ //guild_ids
                parse.ids = filterData[1]
              } else {
                console.log('[EXPERIMENT] Expected guild_ids, got ' + filterData)
              }
            })
            parsedFilters.push(parse)
            break;
          case 2404720969: //guild_id_range
            parse = {
              type: "guild_id_range"
            }
            filter[1].forEach(function(filterData){
              if(filterData[0] == 3399957344){ //min_id
                parse.min_id = filterData[1]
              } else if(filterData[0] == 1238858341){ //max_id
                parse.max_id = filterData[1]
              } else {
                console.log('[EXPERIMENT] Expected min_id or max_id, got ' + filterData)
              }
            })
            parsedFilters.push(parse)
            break;
          case 2918402255: //guild_member_count_range
            parse = {
              type: "guild_member_count_range"
            }
            filter[1].forEach(function(filterData){
              if(filterData[0] == 3399957344){ //min_id
                parse.min_id = filterData[1]
              } else if(filterData[0] == 1238858341){ //max_id
                parse.max_id = filterData[1]
              } else {
                console.log('[EXPERIMENT] Expected min_id or max_id, got ' + filterData)
              }
            })
            parsedFilters.push(parse)
            break;
          default:
            parsedFilters.push({
              type: "unknown_filter",
              hash: filter[0],
              data: filter[1]
            })
            break;
        }
      })
      parsedPopulations.push({
        buckets: parsedBuckets,
        filters: parsedFilters
      })
      parsedExperiment.populations = parsedPopulations
    })
    let parsedOverrides = {};
    experiment[4].forEach(function(override){ //Parse overrides
      parsedOverrides[override.b.toString()] = override.k
    })
    parsedExperiment.overrides = parsedOverrides
    return parsedExperiment;
  }
  